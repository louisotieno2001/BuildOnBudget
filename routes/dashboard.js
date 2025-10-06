const express = require('express');
const router = express.Router();
const url = process.env.DIRECTUS_URL;
const accessToken = process.env.DIRECTUS_TOKEN;

// Helper function to interact with Directus API
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

async function fetchUserProjects(userId) {
    try {
        const res = await query(`/items/projects?filter[user_id][_eq]=${userId}`, {
            method: 'GET',
        });
        const projects = await res.json();
        return projects.data;
    } catch (error) {
        console.error('Error fetching user projects:', error);
        throw new Error('Failed to fetch projects');
    }
}

async function fetchProjectById(projectId) {
    try {
        const res = await query(`/items/projects/${projectId}`, {
            method: 'GET',
        });
        const project = await res.json();
        return project.data;
    } catch (error) {
        console.error('Error fetching project:', error);
        throw new Error('Failed to fetch project');
    }
}

// Dashboard route
router.get('/', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }

    // Fetch user projects
    const userId = req.session.user.id;
    const userEmail = req.session.user.email;
    const projects = await fetchUserProjects(userId);

    // Fetch tasks for each project
    for (let project of projects) {
        try {
            const resTasks = await query(`/items/tasks?filter[project_id][_eq]=${project.id}`);
            const tasks = await resTasks.json();
            project.tasks = tasks.data || [];
        } catch (error) {
            console.error('Error fetching tasks for project:', project.id, error);
            project.tasks = [];
        }
    }

    // Fetch budgets for the user
    let budgets = [];
    try {
        const resBudgets = await query(`/items/budgets?filter[user_id][_eq]=${userId}&fields=*,project_id.*`);
        const budgetsData = await resBudgets.json();
        budgets = budgetsData.data || [];
    } catch (error) {
        console.error('Error fetching budgets:', error);
        budgets = [];
    }

    // Fetch all tasks for stats
    let allTasks = [];
    try {
        const resAllTasks = await query(`/items/tasks?filter[user_id][_eq]=${userId}&fields=*`);
        const allTasksData = await resAllTasks.json();
        allTasks = allTasksData.data || [];
    } catch (error) {
        console.error('Error fetching all tasks:', error);
        allTasks = [];
    }

    // Fetch teams invited by the user
    let teamsByYou = [];
    try {
        const resTeamsByYou = await query(`/items/teams?filter[invited_by][_eq]=${userId}&fields=*`);
        const teamsByYouData = await resTeamsByYou.json();
        teamsByYou = teamsByYouData.data || [];
        // console.log('Fetched teams invited by user:', teamsByYou);
    } catch (error) {
        console.error('Error fetching teams invited by user:', error);
        teamsByYou = [];
    }

    // Fetch teams where user is invited (email matches)
    let teamsInvitedTo = [];
    try {
        const resTeamsInvitedTo = await query(`/items/teams?filter[email][_eq]=${userEmail}&fields=*`);
        const teamsInvitedToData = await resTeamsInvitedTo.json();
        teamsInvitedTo = teamsInvitedToData.data || [];
        // console.log('Fetched teams invited to user:', teamsInvitedTo);
    } catch (error) {
        console.error('Error fetching teams invited to user:', error);
        teamsInvitedTo = [];
    }

    // Collect all project_ids from teams
    const allProjectIds = new Set();
    teamsByYou.forEach(team => allProjectIds.add(team.project_id));
    teamsInvitedTo.forEach(team => allProjectIds.add(team.project_id));
    const projectIds = Array.from(allProjectIds);

    // Fetch projects for these ids
    let projectMap = {};
    if (projectIds.length > 0) {
        try {
            const projectQuery = projectIds.map(id => `filter[id][_in]=${id}`).join('&');
            const resAllProjects = await query(`/items/projects?${projectQuery}&fields=id,name`);
            const allProjects = await resAllProjects.json();
            console.log(allProjects)
            allProjects.data.forEach(p => projectMap[p.id] = p);
        } catch (error) {
            console.error('Error fetching projects for teams:', error);
        }
    }

    // Enrich teams with project data
    teamsByYou = teamsByYou.map(team => ({ ...team, project_id: projectMap[team.project_id] || null }));
    teamsInvitedTo = teamsInvitedTo.map(team => ({ ...team, project_id: projectMap[team.project_id] || null }));

    // Calculate stats
    const activeProjects = projects.length;
    const tasksDue = allTasks.filter(t => t.status !== 'completed').length;
    const budgetSpent = budgets.reduce((sum, b) => sum + parseFloat(b.totalBudget || 0), 0);
    const teamMembers = teamsByYou.filter(t => t.status === 'accepted').length;

    // Task status counts for chart
    const taskStatusCounts = {
        pending: allTasks.filter(t => t.status === 'pending').length,
        in_progress: allTasks.filter(t => t.status === 'in_progress').length,
        completed: allTasks.filter(t => t.status === 'completed').length
    };

    // Monthly completed tasks
    const monthlyCompletedTasks = {};
    allTasks.filter(t => t.status === 'completed').forEach(task => {
        const date = new Date(task.date_created || task.created_at || Date.now());
        const month = date.getFullYear() + '-' + (date.getMonth() + 1).toString().padStart(2, '0');
        monthlyCompletedTasks[month] = (monthlyCompletedTasks[month] || 0) + 1;
    });
    // Generate last 6 months
    const now = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.getFullYear() + '-' + (date.getMonth() + 1).toString().padStart(2, '0');
        last6Months.push(month);
    }
    const monthlyTasksData = last6Months.map(month => monthlyCompletedTasks[month] || 0);
    const monthlyTasksLabels = last6Months;

    // Fetch first few shop items
    let shopItems = [];
    try {
        const resShop = await query('/items/shop?limit=4&fields=*,media.*');
        const shopData = await resShop.json();
        shopItems = shopData.data || [];
    } catch (error) {
        console.error('Error fetching shop items:', error);
        shopItems = [];
    }

    // Fetch ongoing orders (status complete)
    let ongoingOrders = [];
    try {
        const resOngoing = await query(`/items/orders?filter[user_id][_eq]=${userId}&filter[status][_eq]=complete&fields=id,user_id,product_id,status,units,amount_paid, update_date, delivered_date`);
        const ongoingData = await resOngoing.json();
        ongoingOrders = ongoingData.data || [];
        // Fetch product details
        const productIds = ongoingOrders.map(o => o.product_id);
        if (productIds.length > 0) {
            const resProducts = await query(`/items/shop?filter[id][_in]=${productIds.join(',')}&fields=id,name,description,price`);
            const products = await resProducts.json();
            const productMap = {};
            if (products.data) {
                products.data.forEach(p => productMap[p.id] = p);
            }
            ongoingOrders = ongoingOrders.map(o => ({
                ...o,
                product: productMap[o.product_id] || { name: 'Unknown', description: '', price: 0 }
            }));
        }
    } catch (error) {
        console.error('Error fetching ongoing orders:', error);
        ongoingOrders = [];
    }

    // Fetch delivered orders
    let deliveredOrders = [];
    try {
        const resDelivered = await query(`/items/orders?filter[user_id][_eq]=${userId}&filter[status][_eq]=delivered&fields=id,user_id,product_id,status,units,amount_paid, update_date, delivered_date`);
        const deliveredData = await resDelivered.json();
        deliveredOrders = deliveredData.data || [];
        // Fetch product details
        const productIds = deliveredOrders.map(o => o.product_id);
        if (productIds.length > 0) {
            const resProducts = await query(`/items/shop?filter[id][_in]=${productIds.join(',')}&fields=id,name,description,price`);
            const products = await resProducts.json();
            const productMap = {};
            if (products.data) {
                products.data.forEach(p => productMap[p.id] = p);
            }
            deliveredOrders = deliveredOrders.map(o => ({
                ...o,
                product: productMap[o.product_id] || { name: 'Unknown', description: '', price: 0 }
            }));
        }
    } catch (error) {
        console.error('Error fetching delivered orders:', error);
        deliveredOrders = [];
    }

    // Calculate pending notifications
    const pendingNotifications = teamsInvitedTo.filter(t => t.status === 'pending').length;

    req.session.user.projects = projects;

    // Calculate project completion percentages for last 6 months
    const projectCompletionByMonth = {};
    last6Months.forEach(month => {
        projectCompletionByMonth[month] = {};
        projects.forEach(project => {
            const completedTasks = project.tasks.filter(t => t.status === 'completed' && t.date_created && t.date_created.startsWith(month));
            const totalTasks = project.tasks.filter(t => t.date_created && t.date_created.startsWith(month));
            const percentComplete = totalTasks.length > 0 ? (completedTasks.length / totalTasks.length) * 100 : 0;
            projectCompletionByMonth[month][project.name] = percentComplete.toFixed(2);
        });
    });

    // Render dashboard with user data, projects, budgets, and teams
    res.render('dashboard', {
        user: req.session.user,
        projects: projects,
        budgets: budgets,
        teamsByYou: teamsByYou,
        teamsInvitedTo: teamsInvitedTo,
        pendingNotifications: pendingNotifications,
        activeProjects: activeProjects,
        tasksDue: tasksDue,
        budgetSpent: budgetSpent,
        teamMembers: teamMembers,
        taskStatusCounts: taskStatusCounts,
        monthlyTasksLabels: monthlyTasksLabels,
        monthlyTasksData: monthlyTasksData,
        projectCompletionByMonth: projectCompletionByMonth,
        shopItems: shopItems,
        ongoingOrders: ongoingOrders,
        deliveredOrders: deliveredOrders
    });
});

// Project details route
router.get('/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const projectId = req.params.id;
    const project = await fetchProjectById(projectId);
    console.log('Fetched project:', project);

    if (!project) {
        return res.status(404).send('Project not found');
    }

    res.render('project_details', { user: req.session.user, project: project });
});

// Orders route
router.get('/orders', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    const status = req.query.status || 'pending';
    let filter;
    if (status.includes(',')) {
      const statuses = status.split(',');
      filter = `filter[status][_in]=${statuses.join(',')}`;
    } else {
      filter = `filter[status]=${status}`;
    }
    const resOrders = await query(`/items/orders?filter[user_id]=${req.session.user.id}&${filter}&fields=id,user_id,product_id,status,units,amount_paid`);
    const orders = await resOrders.json();
    if (!orders.data) {
      return res.json([]);
    }
    // Fetch product names
    const productIds = orders.data.map(o => o.product_id);
    const resProducts = await query(`/items/shop?filter[id][_in]=${productIds.join(',')}&fields=id,name`);
    const products = await resProducts.json();
    const productMap = {};
    if (products.data) {
      products.data.forEach(p => productMap[p.id] = p.name);
    }
    const ordersWithNames = orders.data.map(o => ({
      ...o,
      product_name: productMap[o.product_id] || 'Unknown'
    }));
    res.json(ordersWithNames);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
