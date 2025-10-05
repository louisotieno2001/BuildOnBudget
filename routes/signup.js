const express = require('express');
const router = express.Router();

// Signup route
router.get('/', (req, res) => {
    res.render('signup');
});

module.exports = router;
