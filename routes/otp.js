const express = require('express');
const router = express.Router();

// OTP route
router.get('/', (req, res) => {
    res.render('otp');
});

module.exports = router;
