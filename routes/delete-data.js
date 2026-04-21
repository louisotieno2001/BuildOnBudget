const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('delete-data');
});

module.exports = router;
