const express = require('express');
const router = express.Router();
const url = process.env.DIRECTUS_URL;
const accessToken = process.env.DIRECTUS_TOKEN;

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

// Budget route
router.get('/', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const user_id = req.session.user.id;
        const resProjects = await query(`/items/projects?filter[user_id][_eq]=${user_id}`);
        const projects = await resProjects.json();
        res.render('budget', { user: req.session.user, projects: projects.data || [] });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.render('budget', { user: req.session.user, projects: [] });
    }
});

module.exports = router;
