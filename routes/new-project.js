const express = require('express');
const router = express.Router();

// New Project route
router.get('/', (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('new-project', { user: req.session.user });
});

module.exports = router;
