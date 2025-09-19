const express = require('express');
const router = express.Router();

// Create new conversation
router.post('/', async (req, res) => {
  try {
    const { business_id } = req.body;

    if (!business_id) {
      return res.status(400).json({ error: 'business_id is required' });
    }

    const conversation = await req.app.locals.dbService.createConversation({
      business_id,
      status: 'active',
      assigned_agent: 'receptionist'
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get conversation details
router.get('/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = await req.app.locals.dbService.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await req.app.locals.dbService.getConversationMessages(conversationId);

    res.json({
      ...conversation,
      messages
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Send message to conversation
router.post('/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { message, sender = 'customer' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Get conversation to determine business_id
    const conversation = await req.app.locals.dbService.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Process message through agent orchestrator
    const response = await req.app.locals.agentOrchestrator.processMessage({
      conversationId,
      message,
      businessId: conversation.business_id,
      timestamp: new Date().toISOString()
    });

    res.json(response);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get business conversations
router.get('/business/:businessId', async (req, res) => {
  try {
    const businessId = req.params.businessId;
    const { status, limit = 20 } = req.query;

    const conversations = await req.app.locals.dbService.getBusinessConversations(
      businessId,
      parseInt(limit),
      status
    );

    res.json(conversations);
  } catch (error) {
    console.error('Error getting business conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Update conversation
router.put('/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const updates = req.body;

    const conversation = await req.app.locals.dbService.updateConversation(conversationId, updates);

    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

module.exports = router;