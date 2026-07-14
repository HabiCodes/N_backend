const express = require('express');
const { listCalls } = require('../controllers/callController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.get('/', requireAuth, listCalls);

module.exports = router;