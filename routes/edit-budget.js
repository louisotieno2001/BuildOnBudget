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

// Edit Budget route
router.get('/:id', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const budgetId = req.params.id;
        const user_id = req.session.user.id;

        // Fetch the budget
        const resBudget = await query(`/items/budgets/${budgetId}?filter[user_id][_eq]=${user_id}`);
        if (!resBudget.ok) {
            return res.status(404).render('error', { message: 'Budget not found' });
        }
        const budget = await resBudget.json();

        // Fetch projects for the dropdown
        const resProjects = await query(`/items/projects?filter[user_id][_eq]=${user_id}`);
        const projects = await resProjects.json();

        res.render('edit-budget', { user: req.session.user, budget: budget.data, projects: projects.data || [] });
    } catch (error) {
        console.error('Error fetching budget:', error);
        res.render('edit-budget', { user: req.session.user, budget: null, projects: [] });
    }
});

module.exports = router;
