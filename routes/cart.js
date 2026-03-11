const express = require('express');
const router = express.Router();
const url = process.env.DIRECTUS_URL;
const accessToken = process.env.DIRECTUS_TOKEN;
const { initiateSTKPush } = require('../mpesa');

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
    if (!req.user) {
        return res.redirect('/login');
    }
    try {
        const wantsJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');
        const buildOrdersWithProducts = async (status) => {
            const resOrdersByStatus = await query(
                `/items/orders?filter[user_id][_eq]=${req.user.id}&filter[status][_eq]=${status}&fields=id,user_id,product_id,status,units,amount_paid, update_date, delivered_date`
            );
            const statusPayload = await resOrdersByStatus.json();
            if (!statusPayload.data || statusPayload.data.length === 0) {
                return [];
            }
            const productIds = statusPayload.data.map(o => o.product_id);
            const resProducts = await query(`/items/shop?filter[id][_in]=${productIds.join(',')}&fields=id,name,description,price,media.*`);
            const productsPayload = await resProducts.json();
            const productMap = {};
            if (productsPayload.data) {
                productsPayload.data.forEach(p => {
                    productMap[p.id] = p;
                });
            }
            return statusPayload.data.map(o => ({
                ...o,
                product: productMap[o.product_id] || null
            })).filter(o => o.product);
        };
        // console.log('User ID:', req.session.user.id);
        // Fetch pending orders for the user
        const resOrders = await query(`/items/orders?filter[user_id]=${req.user.id}&filter[status]=pending&fields=id,user_id,product_id,status,units`);
        // console.log('Response status:', resOrders.status);
        const orders = await resOrders.json();
        // console.log('Orders response:', orders);
        // console.log('Fetched orders:', orders.data);
        let cartItems = [];
        if (orders.data && orders.data.length > 0) {
            // Fetch item details for the products in orders
            const itemIds = orders.data.map(o => o.product_id);
            const resItems = await query(`/items/shop?filter[id][_in]=${itemIds.join(',')}&fields=*,media.*`);
            const items = await resItems.json();
            cartItems = orders.data.map(o => {
                const item = items.data.find(i => i.id == o.product_id);
                if (!item) return null; // Skip if item not found
                const price = parseFloat(item.price);
                const qty = parseInt(o.units);
                return { ...item, quantity: qty, total: price * qty, order_id: o.id };
            }).filter(Boolean);
        }
        if (wantsJson) {
            const [ongoingOrders, deliveredOrders] = await Promise.all([
                buildOrdersWithProducts('complete'),
                buildOrdersWithProducts('delivered')
            ]);
            return res.json({ cartItems, ongoingOrders, deliveredOrders });
        }
        if (!cartItems.length) {
            return res.render('cart', { user: req.user, cartItems: [] });
        }
        res.render('cart', { user: req.user, cartItems });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        const wantsJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');
        if (wantsJson) {
            return res.json({ cartItems: [], ongoingOrders: [], deliveredOrders: [] });
        }
        res.render('cart', { user: req.user, cartItems: [] });
    }
});

// Update cart quantity
router.post('/update', async (req, res) => {
    if (!req.user) {
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

// Checkout - initiate M-Pesa STK Push
router.post('/checkout', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        // Fetch pending orders for the user
        const resOrders = await query(`/items/orders?filter[user_id]=${req.user.id}&filter[status]=pending&fields=id,user_id,product_id,status,units`);
        const orders = await resOrders.json();
        if (!orders.data || orders.data.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        // Fetch item details
        const itemIds = orders.data.map(o => o.product_id);
        const resItems = await query(`/items/shop?filter[id][_in]=${itemIds.join(',')}&fields=*,media.*`);
        const items = await resItems.json();

        // Calculate total amount
        let totalAmount = 0;
        for (const order of orders.data) {
            const item = items.data.find(i => i.id == order.product_id);
            totalAmount += parseFloat(item.price) * parseInt(order.units);
        }

        // Get phone number from request body, fallback to session
        const phoneNumber = req.body.phone || req.user.phone;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const accountReference = `Order-${req.user.id}-${Date.now()}`;
        const transactionDesc = 'Payment for BuildOnBudget order';

        const stkPushResponse = await initiateSTKPush(phoneNumber, totalAmount, accountReference, transactionDesc);

        // Store STK Push details in session or database for callback verification
        const pendingPaymentData = {
            checkout_request_id: stkPushResponse.CheckoutRequestID,
            user_id: req.user.id,
            orders: orders.data,
            items: items.data,
            total_amount: totalAmount,
            account_reference: accountReference,
            phone: phoneNumber,
            status: 'pending'
        };

        await query('/items/pending_payments', {
            method: 'POST',
            body: JSON.stringify(pendingPaymentData)
        });

        res.json({
            message: 'STK Push initiated. Please check your phone to complete payment.',
            checkoutRequestId: stkPushResponse.CheckoutRequestID
        });
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ error: 'Failed to initiate payment' });
    }
});

module.exports = router;
