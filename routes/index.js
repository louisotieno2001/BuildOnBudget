const express = require('express');
const router = express.Router();

// Home route
router.get('/', (req, res) => {
    res.render('index');
});

// Demo route
router.get('/demo', (req, res) => {
    res.render('demo');
});

module.exports = router;
