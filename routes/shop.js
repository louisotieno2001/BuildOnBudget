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
        const resItems = await query('/items/products?fields=*,media.*');
        const items = await resItems.json();
        // Fetch cart count (pending orders)
        const resOrders = await query(`/items/orders?filter[user_id][_eq]=${req.session.user.id}&filter[status][_eq]=pending`);
        const orders = await resOrders.json();
        const cartCount = orders.data ? orders.data.length : 0;
        res.render('shop', { user: req.session.user, items: items.data || [], cartCount });
    } catch (error) {
        console.error('Error fetching shop items:', error);
        res.render('shop', { user: req.session.user, items: [] });
    }
});

// Add to cart
router.post('/add-to-cart', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { item_id, quantity } = req.body;
    try {
        // Insert into orders collection with status pending
        const orderData = {
            user_id: req.session.user.id,
            product_id: item_id,
            status: 'pending',
            units: parseInt(quantity)
        };
        const resOrder = await query('/items/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        if (resOrder.ok) {
            res.json({ message: 'Added to cart' });
        } else {
            res.status(500).json({ error: 'Failed to add to cart' });
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
