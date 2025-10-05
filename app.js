// Imports
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const multer = require('multer');
const upload = multer().array('attachments', 10);
const { createProxyMiddleware } = require('http-proxy-middleware');
const cookieParser = require('cookie-parser');

// Declarations
const app = express();
const PORT = process.env.PORT || 3000;
const url = process.env.DIRECTUS_URL;
const accessToken = process.env.DIRECTUS_TOKEN;

// Initializations
const apiProxy = createProxyMiddleware({
    target: 'http://0.0.0.0:8055',
    changeOrigin: true,
});

// Postgresql conf
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
});

// Middleware definitions
app.use('/assets', apiProxy);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(cors());
app.set('view engine', 'ejs');
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
    }),
    secret: 'sqT_qxwhkalprcnS*4345khsags',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 100
    }
}));

// Session check
const checkSession = (req, res, next) => {
    if (req.session.user) {
        next()
    } else {
        res.redirect('/login')
    }
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

// Assets API
async function uploadToDirectus(file) {
    const formData = new FormData();
    formData.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });
    try {
        const res = await fetch(`${url}/files`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${accessToken}`,
            },
            body: formData
        });
        const uploadedAsset = await res.json();
        return uploadedAsset;
    } catch (error) {
        console.error('Error uploading to directus', error);
        throw new Error('Failed to upload file')
    }
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

        console.log('Userdata', req.body)

        if(!name || !email || !phone || !password){
            return res.status(400).json({error: 'Please fill all the fields'});
        }

        const userData = {
            name, email, phone, password
        };

        const newUser = await signupUser(userData);

        console.log("Directus", newUser)

        res.status(201).json({ message: 'User registered succesfully', user: newUser});
    } catch (error) {
        console.error('Error inserting user', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function loginUser(email) {
    try {
        const res = await query(`/items/users?filter[email][_eq]=${email}`, {
            method: 'GET',
        });

        const users = await res.json();

        return users;
    } catch (error) {
        console.error('Error querying user data:', error);
        throw new Error('Error querying user data')
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

        req.session.user = user;
        return res.status(200).json({ message: 'Login successful', redirect: '/dashboard'})
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

app.get('/logout', async (req, res) => {
  try {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).send('Error logging out');
      }

      // Clear the session cookie
      res.clearCookie('connect.sid');

      // Redirect to home page
      return res.redirect('/');
    });
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

app.post('/new-project', upload, async (req, res) => {
    try {
        const { name, type, client_name, client_contact, location, description, budget, start_date, end_date, materials, contractors, permits, safety } = req.body;

        const user_id = req.session.user.id;

        if (!name || !type || !location || !budget || !start_date) {
            return res.status(400).json({ error: 'Please fill in all required fields' });
        }

        const attachments = req.files || [];
        const attachmentIds = [];
        if (attachments.length > 0) {
            for (let file of attachments) {
                try {
                    const uploaded = await uploadToDirectus(file);
                    attachmentIds.push(uploaded.data.id);
                } catch (err) {
                    console.error('Error uploading file:', err);
                }
            }
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
            media: attachmentIds,
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

app.post('/new-task', async (req, res) => {
    try {
        const { project_id, name, description, assigned_to, start_date, end_date, priority, status } = req.body;

        const user_id = req.session.user.id;

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

        const user_id = req.session.user.id;

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
        const userId = req.session.user.id;
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
            // Update session
            req.session.user = { ...req.session.user, ...updateData };
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

        const user_id = req.session.user.id;

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

        const user_id = req.session.user.id;

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
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user_id = req.session.user.id;
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});