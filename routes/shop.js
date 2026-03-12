const express = require('express');
const router = express.Router();
const url = process.env.DIRECTUS_URL;
const accessToken = process.env.DIRECTUS_TOKEN;
const { normalizeMediaUrl } = require('../utils/media');

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
    const wantsJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');
    if (!req.user) {
        if (wantsJson) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');
    }
    try {
        const assetBaseUrl = `${req.protocol}://${req.get('host')}`;
        const resItems = await query('/items/shop?fields=*');
        const items = await resItems.json();
        const enrichedItems = (items.data || []).map(item => ({
            ...item,
            media_url: normalizeMediaUrl(item.media, { baseUrl: assetBaseUrl })
        }));
        // Fetch cart count (pending orders)
        const resOrders = await query(`/items/orders?filter[user_id][_eq]=${req.user.id}&filter[status][_eq]=pending`);
        const orders = await resOrders.json();
        const cartCount = orders.data ? orders.data.length : 0;
        if (wantsJson) {
            return res.json({ items: enrichedItems, cartCount });
        }
        res.render('shop', { user: req.user, items: enrichedItems, cartCount, directusToken: accessToken });
    } catch (error) {
        console.error('Error fetching shop items:', error);
        if (wantsJson) {
            return res.json({ items: [], cartCount: 0 });
        }
        res.render('shop', { user: req.user, items: [], cartCount: 0, directusToken: accessToken });
    }
});

// Add to cart
router.post('/add-to-cart', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { item_id, quantity } = req.body;
    const current_date = new Date();
    try {
        // Insert into orders collection with status pending
        const orderData = {
            user_id: req.user.id,
            product_id: item_id,
            status: 'pending',
            units: parseInt(quantity),
            creation_date: current_date
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
