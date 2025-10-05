const express = require('express');
const router = express.Router();

// Login route
router.get('/', (req, res) => {
    res.render('login');
});

module.exports = router;
