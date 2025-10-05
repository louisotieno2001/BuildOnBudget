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
        // console.log('User ID:', req.session.user.id);
        // Fetch pending orders for the user
        const resOrders = await query(`/items/orders?filter[user_id]=${req.session.user.id}&filter[status]=pending&fields=id,user_id,product_id,status,units`);
        // console.log('Response status:', resOrders.status);
        const orders = await resOrders.json();
        // console.log('Orders response:', orders);
        // console.log('Fetched orders:', orders.data);
        if (!orders.data || orders.data.length === 0) {
            return res.render('cart', { user: req.session.user, cartItems: [] });
        }
        // Fetch item details for the products in orders
        const itemIds = orders.data.map(o => o.product_id);
        const resItems = await query(`/items/shop?filter[id][_in]=${itemIds.join(',')}`);
        const items = await resItems.json();
        const cartItems = orders.data.map(o => {
            const item = items.data.find(i => i.id == o.product_id);
            if (!item) return null; // Skip if item not found
            const price = parseFloat(item.price);
            const qty = parseInt(o.units);
            return { ...item, quantity: qty, total: price * qty, order_id: o.id };
        }).filter(Boolean);
        res.render('cart', { user: req.session.user, cartItems });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.render('cart', { user: req.session.user, cartItems: [] });
    }
});

// Update cart quantity
router.post('/update', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { order_id, quantity } = req.body;
    try {
        const newQuantity = parseInt(quantity);
        if (newQuantity <= 0) {
            // Delete the order
            await query(`/items/orders/${order_id}`, {
                method: 'DELETE'
            });
        } else {
            // Update the order quantity
            await query(`/items/orders/${order_id}`, {
                method: 'PATCH',
                body: JSON.stringify({ units: newQuantity })
            });
        }
        res.json({ message: 'Cart updated' });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Checkout - update orders to complete
router.post('/checkout', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        // Fetch pending orders for the user
        const resOrders = await query(`/items/orders?filter[user_id]=${req.session.user.id}&filter[status]=pending&fields=id,user_id,product_id,status,units`);
        const orders = await resOrders.json();
        // console.log('Checkout orders:', orders.data);
        if (!orders.data || orders.data.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        // Fetch item details
        const itemIds = orders.data.map(o => o.product_id);
        const resItems = await query(`/items/shop?filter[id][_in]=${itemIds.join(',')}`);
        const items = await resItems.json();
        
        // Update each order to complete
        for (const order of orders.data) {
            const item = items.data.find(i => i.id == order.product_id);
            const amount_paid = parseFloat(item.price) * parseInt(order.units);
            const payment_message = `paid by ${req.session.user.name}`;
            // console.log('Updating order:', order.id, 'amount_paid:', amount_paid, 'units:', order.units, 'payment_message:', payment_message);
            await query(`/items/orders/${order.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'complete',
                    amount_paid,
                    units: parseInt(order.units),
                    payment_message
                })
            });
        }
        res.json({ message: 'Order placed successfully' });
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
