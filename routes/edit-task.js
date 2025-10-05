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

// Edit Task route
router.get('/:id', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const taskId = req.params.id;
        const user_id = req.session.user.id;

        // Fetch the task
        const resTask = await query(`/items/tasks/${taskId}?filter[user_id][_eq]=${user_id}`);
        if (!resTask.ok) {
            return res.status(404).render('error', { message: 'Task not found' });
        }
        const task = await resTask.json();

        // Fetch projects for the dropdown
        const resProjects = await query(`/items/projects?filter[user_id][_eq]=${user_id}`);
        const projects = await resProjects.json();

        res.render('edit-tasks', { user: req.session.user, task: task.data, projects: projects.data || [] });
    } catch (error) {
        console.error('Error fetching task:', error);
        res.render('edit-tasks', { user: req.session.user, task: null, projects: [] });
    }
});

module.exports = router;
