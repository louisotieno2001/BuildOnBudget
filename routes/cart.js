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

// Cart route
router.get('/', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const cart = req.session.cart || [];
        // Fetch item details for cart items
        const itemIds = cart.map(c => c.item_id);
        if (itemIds.length === 0) {
            return res.render('cart', { user: req.session.user, cartItems: [] });
        }
        const resItems = await query(`/items/shop?filter[id][_in]=${itemIds.join(',')}`);
        const items = await resItems.json();
        const cartItems = cart.map(c => {
            const item = items.data.find(i => i.id == c.item_id);
            return { ...item, quantity: c.quantity, total: item.price * c.quantity };
        });
        res.render('cart', { user: req.session.user, cartItems });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.render('cart', { user: req.session.user, cartItems: [] });
    }
});

// Update cart quantity
router.post('/update', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { item_id, quantity } = req.body;
    if (!req.session.cart) req.session.cart = [];
    const item = req.session.cart.find(i => i.item_id == item_id);
    if (item) {
        item.quantity = parseInt(quantity);
        if (item.quantity <= 0) {
            req.session.cart = req.session.cart.filter(i => i.item_id != item_id);
        }
    }
    res.json({ message: 'Cart updated' });
});

// Checkout - create order
router.post('/checkout', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const cart = req.session.cart || [];
        if (cart.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        // Fetch item details
        const itemIds = cart.map(c => c.item_id);
        const resItems = await query(`/items/shop?filter[id][_in]=${itemIds.join(',')}`);
        const items = await resItems.json();
        const orderItems = cart.map(c => {
            const item = items.data.find(i => i.id == c.item_id);
            return { item_id: c.item_id, name: item.name, quantity: c.quantity, price: item.price };
        });
        const total = orderItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0);
        // Create order in orders collection
        const orderData = {
            user_id: req.session.user.id,
            items: orderItems,
            total,
            status: 'pending'
        };
        const resOrder = await query('/items/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        if (resOrder.ok) {
            req.session.cart = []; // Clear cart
            res.json({ message: 'Order placed successfully' });
        } else {
            res.status(500).json({ error: 'Failed to place order' });
        }
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
