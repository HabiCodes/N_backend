const express = require('express');
const { listConversations, startConversation, getMessages } = require('../controllers/conversationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listConversations);
router.post('/', requireAuth, startConversation);
router.get('/:conversationId/messages', requireAuth, getMessages);

module.exports = router;
