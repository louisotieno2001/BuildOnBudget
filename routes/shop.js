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

// Shop route
router.get('/', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const resItems = await query('/items/shop?fields=*,media.*');
        const items = await resItems.json();
        console.log(items)
        res.render('shop', { user: req.session.user, items: items.data || [], cartCount: (req.session.cart || []).length });
    } catch (error) {
        console.error('Error fetching shop items:', error);
        res.render('shop', { user: req.session.user, items: [] });
    }
});

// Add to cart
router.post('/add-to-cart', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { item_id, quantity } = req.body;
    if (!req.session.cart) req.session.cart = [];
    const existing = req.session.cart.find(i => i.item_id == item_id);
    if (existing) {
        existing.quantity += parseInt(quantity);
    } else {
        req.session.cart.push({ item_id, quantity: parseInt(quantity) });
    }
    res.json({ message: 'Added to cart' });
});

module.exports = router;
