const express = require('express');
const { search } = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/search', requireAuth, search); // GET /api/users/search?q=habi

module.exports = router;
