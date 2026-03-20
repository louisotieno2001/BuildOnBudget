// Imports
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { normalizeMediaUrl } = require('./utils/media');

// Declarations
const app = express();
const PORT = process.env.EXPRESS_PORT || 3000;
const url = process.env.DIRECTUS_URL;
const accessToken = process.env.DIRECTUS_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const AUTH_COOKIE_NAME = 'auth_token';
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19000',
  'exp://localhost:19000',
  'http://localhost:3000',
  'http://localhost:8055',
  'https://www.buildonbudget.hustlerati.com',
];
const envAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const normalizeOrigin = (value) => {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch (error) {
    return value.replace(/\/+$/, '');
  }
};

const allowedOrigins = Array.from(
  new Set(
    [...DEFAULT_ALLOWED_ORIGINS, ...envAllowedOrigins]
      .map((origin) => normalizeOrigin(origin))
      .filter(Boolean)
  )
);

// Proxy configuration
const apiProxy = createProxyMiddleware({
    target: 'http://directus:8055', // Directus Docker service hostname
    changeOrigin: true,
    pathRewrite: {
        '^/assets': '/assets' // Keep /assets prefix for Directus
    },
    onProxyReq: (proxyReq, req, res) => {
        // Add authorization header
        proxyReq.setHeader('Authorization', 'Bearer ' + accessToken);
    }
});

// Guard: if a raw Directus file ID is requested without /assets, redirect it.
app.get('/:fileId', (req, res, next) => {
    const fileId = req.params.fileId;
    if (!/^[0-9a-fA-F-]{36}$/.test(fileId)) {
        return next();
    }
    const referer = req.get('referer') || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    console.warn(`Redirecting raw file id request to /assets/${fileId} (referer: ${referer}, ua: ${userAgent})`);
    return res.redirect(302, `/assets/${fileId}`);
});

// Custom route to serve Directus files from the uploads folder.
// Falls back to the proxy if no local match is found.
app.get('/assets/:filename', async (req, res, next) => {
    const filename = req.params.filename;
    const uploadsPath = '/directus/uploads';
    
    try {
        // Try to find the file by ID (filename_disk)
        const fs = require('fs');
        const path = require('path');
        
        // List files in the uploads directory
        const files = fs.readdirSync(uploadsPath);
        
        // Find file that starts with the requested filename
        const matchedFile = files.find(f => f.startsWith(filename));
        
        if (matchedFile) {
            const filePath = path.join(uploadsPath, matchedFile);
            const stat = fs.statSync(filePath);
            
            // Determine content type from extension
            const ext = path.extname(matchedFile).toLowerCase();
            const contentTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.avif': 'image/avif',
                '.svg': 'image/svg+xml',
                '.pdf': 'application/pdf'
            };
            const contentType = contentTypes[ext] || 'application/octet-stream';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        } else {
            return next();
        }
    } catch (error) {
        console.error('Error serving file:', error);
        return next(error);
    }
});

// Middleware definitions
app.use('/assets', apiProxy);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }));
app.use(bodyParser.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.locals.normalizeMediaUrl = normalizeMediaUrl;
app.use(cors({
  origin: (origin, callback) => {
    // Native mobile requests often omit Origin entirely.
    if (!origin) return callback(null, true);
    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

const isProd = process.env.NODE_ENV === 'production';

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function attachUserFromToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const cookieToken = req.cookies[AUTH_COOKIE_NAME];
    const token = bearerToken || cookieToken;

    if (!token) {
        return next();
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
    } catch (error) {
        // Invalid token; ignore and continue.
    }
    return next();
}

app.use(attachUserFromToken);

// Session check
const checkSession = (req, res, next) => {
    if (req.user) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
}

// Query function to directus API endpoints
async function query(path, config) {
    try {
        const res = await fetch(encodeURI(`${url}${path}`), {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            ...config
        });
        return res;
    } catch (error) {
        console.error('Error during fetch:', error);
        throw new Error('Database connection failed.')
    }
}

function normalizeBase64Payload(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const trimmed = payload.trim();
    const commaIndex = trimmed.indexOf(',');
    if (trimmed.startsWith('data:') && commaIndex !== -1) {
        return trimmed.slice(commaIndex + 1);
    }
    return trimmed;
}

// Route definitions
const indexRoute = require('./routes/index');
app.use('/', indexRoute);
const signupRoute = require('./routes/signup');
app.use('/signup', signupRoute);
const loginRoute = require('./routes/login');
app.use('/login', loginRoute);
const dashboardRoute = require('./routes/dashboard');
app.use('/dashboard', dashboardRoute);
const otpRoute = require('./routes/otp');
app.use('/otp', otpRoute);
const newProjectRoute = require('./routes/new-project');
app.use('/new-project', newProjectRoute);
const newTaskRoute = require('./routes/new-task');
app.use('/new-task', newTaskRoute);
const editTaskRoute = require('./routes/edit-task');
app.use('/edit-task', editTaskRoute);
const shopRoute = require('./routes/shop');
app.use('/shop', shopRoute);
const cartRoute = require('./routes/cart');
app.use('/cart', cartRoute);
const mpesaRoute = require('./routes/mpesa');
app.use('/mpesa', mpesaRoute);
const editBudgetRoute = require('./routes/edit-budget');
app.use('/edit-budget', editBudgetRoute);
const inviteMemberRoute = require('./routes/invite-member');
app.use('/invite-member', inviteMemberRoute);
const budgetRoute = require('./routes/budget');
app.use('/budget', budgetRoute);

async function signupUser(userData) {
    let res = await query(`/items/users`, {
        method: 'POST',
        body: JSON.stringify(userData)
    });
    return await res.json();
}

app.post('/signup', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // console.log('Userdata', req.body)

        if(!name || !email || !phone || !password){
            return res.status(400).json({error: 'Please fill all the fields'});
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = {
            name, email, phone, password: hashedPassword
        };

        const newUser = await signupUser(userData);

        // console.log("Directus", newUser)

        if (newUser && newUser.data && newUser.data.password) {
            delete newUser.data.password;
        }

        const createdUser = newUser && newUser.data ? newUser.data : null;
        const safeUser = createdUser
            ? { id: createdUser.id, email: createdUser.email, name: createdUser.name, phone: createdUser.phone }
            : null;
        const token = safeUser ? signToken(safeUser) : undefined;

        if (token) {
            res.cookie(AUTH_COOKIE_NAME, token, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
        }

        res.status(201).json({ message: 'User registered succesfully', user: newUser, token });
    } catch (error) {
        console.error('Error inserting user', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function loginUser(email) {
    try {
        const res = await query(`/items/users?filter[email][_eq]=${email}&fields=*`, {
            method: 'GET',
        });

        const users = await res.json();

        return users;
    } catch (error) {
        console.error('Error querying user data:', error);
        throw new Error('Error querying user data')
    }
}

async function updateUserPassword(userId, hashedPassword) {
    try {
        await query(`/items/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ password: hashedPassword })
        });
    } catch (error) {
        console.error('Error upgrading password hash:', error);
    }
}

app.post('/login', async(req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Please fill in all fields' });
        }

        const users = await loginUser(email);

        if (!users || !users.data || users.data.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users.data[0];
        const storedPassword = user.password || '';

        const isBcrypt = typeof storedPassword === 'string' && storedPassword.startsWith('$2');
        const passwordMatches = isBcrypt
            ? await bcrypt.compare(password, storedPassword)
            : storedPassword === password;

        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!isBcrypt) {
            const upgraded = await bcrypt.hash(password, 10);
            await updateUserPassword(user.id, upgraded);
        }

        const safeUser = { id: user.id, email: user.email, name: user.name, phone: user.phone };

        const token = signToken(safeUser);
        res.cookie(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({ message: 'Login successful', token, redirect: '/dashboard'})
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

app.get('/logout', async (req, res) => {
  try {
    res.clearCookie('connect.sid');
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.redirect('/');
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).send('Server error during logout');
  }
});

async function createProject(userData) {
    let res = await query(`/items/projects`, {
        method: 'POST',
        body: JSON.stringify(userData)
    });
    return await res.json();
}

async function createTask(taskData) {
    let res = await query(`/items/tasks`, {
        method: 'POST',
        body: JSON.stringify(taskData)
    });
    return await res.json();
}

const upload = multer({
    storage: multer.diskStorage({
        destination: '/tmp',
        filename: (req, file, cb) => {
            const safeName = file.originalname ? file.originalname.replace(/\\s+/g, '_') : 'attachment.pdf';
            cb(null, `${Date.now()}-${safeName}`);
        }
    }),
    limits: { fileSize: 500 * 1024 * 1024 },
});

app.post('/new-project', checkSession, upload.single('attachment'), async (req, res) => {
    try {
        const {
            name,
            type,
            client_name,
            client_contact,
            location,
            description,
            budget,
            start_date,
            end_date,
            materials,
            contractors,
            permits,
            safety,
            attachment_name,
            attachment_type,
            attachment_base64
        } = req.body;

        const user_id = req.user.id;

        if (!name || !type || !location || !budget || !start_date) {
            return res.status(400).json({ error: 'Please fill in all required fields' });
        }

        let normalizedBase64 = normalizeBase64Payload(attachment_base64);
        let finalAttachmentName = attachment_name || null;
        let finalAttachmentType = attachment_type || null;

        if (req.file) {
            const fs = require('fs');
            const fileBuffer = fs.readFileSync(req.file.path);
            normalizedBase64 = fileBuffer.toString('base64');
            finalAttachmentName = req.file.originalname || req.file.filename;
            finalAttachmentType = req.file.mimetype || 'application/octet-stream';
            fs.unlink(req.file.path, () => {});
        }

        const projectData = {
            name,
            type,
            client_name,
            client_contact,
            location,
            description,
            budget: parseFloat(budget),
            start_date,
            deadline: end_date,
            materials,
            contractors,
            permits,
            safety,
            attachment_name: finalAttachmentName,
            attachment_type: finalAttachmentType,
            attachment_base64: normalizedBase64 || null,
            status: false,
            user_id: user_id
        };

        const newProject = await createProject(projectData);

        res.status(201).json({ message: 'Project created successfully', project: newProject });
    } catch (error) {
        console.error('Error creating project', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/projects/:id/attachment', checkSession, async (req, res) => {
    try {
        const projectId = req.params.id;
        const resProject = await query(`/items/projects/${projectId}?fields=attachment_base64,attachment_name,attachment_type,user_id`, {
            method: 'GET',
        });
        if (!resProject.ok) {
            return res.status(404).send('Project not found');
        }
        const project = await resProject.json();
        const data = project && project.data ? project.data : null;
        if (!data || data.user_id !== req.user.id) {
            return res.status(404).send('Attachment not found');
        }
        if (!data.attachment_base64) {
            return res.status(404).send('Attachment not found');
        }

        const buffer = Buffer.from(data.attachment_base64, 'base64');
        const contentType = data.attachment_type || 'application/octet-stream';
        const fileName = data.attachment_name || `project-${projectId}-attachment`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        return res.status(200).send(buffer);
    } catch (error) {
        console.error('Error fetching project attachment', error);
        res.status(500).send('Internal server error');
    }
});

app.post('/new-task', checkSession, async (req, res) => {
    try {
        const { project_id, name, description, assigned_to, start_date, end_date, priority, status } = req.body;

        const user_id = req.user.id;

        if (!project_id || !name) {
            return res.status(400).json({ error: 'Please fill in required fields' });
        }

        const taskData = {
            project_id,
            name,
            description,
            assigned_to,
            start_date,
            end_date,
            priority,
            status: status || 'pending',
            user_id
        };

        const newTask = await createTask(taskData);

        res.status(201).json({ message: 'Task created successfully', task: newTask });
    } catch (error) {
        console.error('Error creating task', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.patch('/task/:id', checkSession, async (req, res) => {
    try {
        const taskId = req.params.id;
        const updateData = req.body;
        const resUpdate = await query(`/items/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });
        if (resUpdate.ok) {
            res.status(200).json({ message: 'Task updated' });
        } else {
            res.status(500).json({ error: 'Failed to update task' });
        }
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/task/:id', checkSession, async (req, res) => {
    try {
        const taskId = req.params.id;
        const resDelete = await query(`/items/tasks/${taskId}`, {
            method: 'DELETE'
        });
        if (resDelete.ok) {
            res.status(200).json({ message: 'Task deleted' });
        } else {
            res.status(500).json({ error: 'Failed to delete task' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.patch('/team/:id', checkSession, async (req, res) => {
    try {
        const teamId = req.params.id;
        const updateData = req.body;
        const resUpdate = await query(`/items/teams/${teamId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });
        if (resUpdate.ok) {
            res.status(200).json({ message: 'Team updated' });
        } else {
            res.status(500).json({ error: 'Failed to update team' });
        }
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/edit-task/:id', checkSession, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { project_id, name, description, assigned_to, start_date, end_date, priority, status } = req.body;

        const user_id = req.user.id;

        if (!project_id || !name) {
            return res.status(400).json({ error: 'Please fill in required fields' });
        }

        const updateData = {
            project_id,
            name,
            description,
            assigned_to,
            start_date,
            end_date,
            priority,
            status
        };

        const resUpdate = await query(`/items/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        if (resUpdate.ok) {
            res.status(200).json({ message: 'Task updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update task' });
        }
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/update-user', checkSession, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, profile_image } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (profile_image) updateData.profile_image = profile_image;

        const resUpdate = await query(`/items/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        if (resUpdate.ok) {
            res.status(200).json({ message: 'User updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update user' });
        }
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/edit-budget/:id', checkSession, async (req, res) => {
    try {
        const budgetId = req.params.id;
        const { project_id, totalBudget, components } = req.body;

        const user_id = req.user.id;

        if (!project_id || !totalBudget) {
            return res.status(400).json({ error: 'Please fill in required fields' });
        }

        const updateData = {
            project_id,
            totalBudget,
            components
        };

        const resUpdate = await query(`/items/budgets/${budgetId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });

        if (resUpdate.ok) {
            res.status(200).json({ message: 'Budget updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update budget' });
        }
    } catch (error) {
        console.error('Error updating budget:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/invite-member', checkSession, async (req, res) => {
    try {
        const { project_id, email, role } = req.body;

        const user_id = req.user.id;

        if (!project_id || !email || !role) {
            return res.status(400).json({ error: 'Please fill in all required fields' });
        }

        const teamData = {
            project_id,
            email,
            role,
            invited_by: user_id,
            status: 'pending'
        };

        const resCreate = await query('/items/teams', {
            method: 'POST',
            body: JSON.stringify(teamData)
        });

        if (resCreate.ok) {
            res.status(201).json({ message: 'Invitation sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send invitation' });
        }
    } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/budget', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user_id = req.user.id;
        const { projectId, totalBudget, components } = req.body;

        if (!projectId || !totalBudget || !components || !Array.isArray(components)) {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        // Prepare budget data for Directus
        const budgetData = {
            user_id,
            project_id: projectId,
            totalBudget,
            components
        };

        const resCreate = await query('/items/budgets', {
            method: 'POST',
            body: JSON.stringify(budgetData)
        });

        if (resCreate.ok) {
            const createdBudget = await resCreate.json();
            res.status(201).json({ message: 'Budget created successfully', budget: createdBudget.data });
        } else {
            res.status(500).json({ error: 'Failed to create budget' });
        }
    } catch (error) {
        console.error('Error creating budget:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/budget/:id', checkSession, async (req, res) => {
    try {
        const budgetId = req.params.id;
        const resDelete = await query(`/items/budgets/${budgetId}`, {
            method: 'DELETE'
        });
        if (resDelete.ok) {
            res.status(200).json({ message: 'Budget deleted' });
        } else {
            res.status(500).json({ error: 'Failed to delete budget' });
        }
    } catch (error) {
        console.error('Error deleting budget:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3D Model API endpoints (mock for demo)
app.get('/projects/:id/3d-model', checkSession, async (req, res) => {
  // Mock response matching frontend/EJS expectations
  res.json({
    modelUrl: 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf',
    status: 'ready',
    progress: 100
  });
});

app.post('/projects/:id/docs', checkSession, upload.array('docs', 10), async (req, res) => {
  console.log(`Mock upload ${req.files?.length || 0} docs for project ${req.params.id}`);
  res.json({ jobId: `mock-${Date.now()}` });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
