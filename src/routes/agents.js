const express = require('express');
const router = express.Router();

// Get agent configuration for business
router.get('/business/:businessId', async (req, res) => {
  try {
    const businessId = req.params.businessId;

    const agentConfigs = await req.app.locals.dbService.supabase
      .from('agent_configs')
      .select('*')
      .eq('business_id', businessId)
      .eq('active', true);

    res.json(agentConfigs.data || []);
  } catch (error) {
    console.error('Error getting agent configs:', error);
    res.status(500).json({ error: 'Failed to get agent configurations' });
  }
});

// Update agent configuration
router.put('/:businessId/:agentType', async (req, res) => {
  try {
    const { businessId, agentType } = req.params;
    const updates = req.body;

    const agentConfig = await req.app.locals.dbService.updateAgentConfig(
      businessId,
      agentType,
      updates
    );

    res.json(agentConfig);
  } catch (error) {
    console.error('Error updating agent config:', error);
    res.status(500).json({ error: 'Failed to update agent configuration' });
  }
});

// Chat endpoint for real conversations
router.post('/chat', async (req, res) => {
  try {
    const { message, businessId, conversationId } = req.body;

    if (!message || !businessId) {
      return res.status(400).json({ error: 'message and businessId are required' });
    }

    // Generate conversation ID if not provided
    const { v4: uuidv4 } = require('uuid');
    const actualConversationId = conversationId || uuidv4();

    // Process message through orchestrator
    const response = await req.app.locals.agentOrchestrator.processMessage({
      conversationId: actualConversationId,
      message,
      businessId,
      timestamp: new Date().toISOString()
    });

    res.json({
      conversationId: actualConversationId,
      response
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Test agent response (for development/testing)
router.post('/test', async (req, res) => {
  try {
    const { message, businessId, agentType = 'receptionist' } = req.body;

    if (!message || !businessId) {
      return res.status(400).json({ error: 'message and businessId are required' });
    }

    // Create a test conversation context
    const { v4: uuidv4 } = require('uuid');
    const testConversation = {
      id: uuidv4(),
      business_id: businessId,
      status: 'active',
      messageCount: 0,
      businessConfig: await req.app.locals.dbService.getBusinessConfig(businessId)
    };

    // Get the specific agent
    const agents = req.app.locals.agentOrchestrator.agents;
    const agent = agents.get(agentType);

    if (!agent) {
      return res.status(400).json({ error: `Agent type '${agentType}' not found` });
    }

    // Process test message
    const response = await agent.processMessage(message, testConversation);

    res.json({
      testMessage: message,
      agentType,
      response
    });
  } catch (error) {
    console.error('Error testing agent:', error);
    res.status(500).json({ error: 'Failed to test agent' });
  }
});

module.exports = router;