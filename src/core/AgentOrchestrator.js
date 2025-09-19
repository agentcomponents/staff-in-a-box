const ReceptionistAgent = require('../agents/ReceptionistAgent');
const SalesAgent = require('../agents/SalesAgent');
const CoordinatorAgent = require('../agents/CoordinatorAgent');
const logger = require('../utils/logger');

class AgentOrchestrator {
  constructor(dbService, notificationService) {
    this.dbService = dbService;
    this.notificationService = notificationService;
    this.agents = new Map();
    this.activeConversations = new Map();

    this.initializeAgents();
  }

  initializeAgents() {
    // All businesses get Receptionist and Coordinator by default
    this.agents.set('receptionist', new ReceptionistAgent(this.dbService, this.notificationService));
    this.agents.set('coordinator', new CoordinatorAgent(this.dbService, this.notificationService));

    // Sales agent can be enabled per business
    this.agents.set('sales', new SalesAgent(this.dbService, this.notificationService));
  }

  async processMessage(messageData) {
    const { conversationId, message, businessId, timestamp } = messageData;

    try {
      // Get or create conversation context
      let conversation = await this.getConversationContext(conversationId, businessId);

      // Update conversation with new message
      await this.saveMessage(conversationId, 'customer', message, timestamp);

      // Determine which agent should handle this message
      const assignedAgent = await this.routeMessage(conversation, message);

      // Process message with appropriate agent
      const agentResponse = await assignedAgent.processMessage(message, conversation);

      // Save agent response
      await this.saveMessage(conversationId, agentResponse.agentType, agentResponse.message, timestamp);

      // Update conversation state
      await this.updateConversationState(conversationId, agentResponse);

      // Handle any special actions (escalations, notifications, etc.)
      await this.handleAgentActions(agentResponse, conversation);

      return {
        ...agentResponse,
        conversationId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error processing message:', error);
      throw error;
    }
  }

  async routeMessage(conversation, message) {
    const coordinator = this.agents.get('coordinator');

    // Coordinator decides which agent should handle the message
    const routing = await coordinator.analyzeMessage(message, conversation);

    const agentType = routing.assignedAgent || 'receptionist';
    return this.agents.get(agentType);
  }

  async getConversationContext(conversationId, businessId) {
    try {
      // Try to get existing conversation
      let conversation = await this.dbService.getConversation(conversationId);

      if (!conversation) {
        // Create new conversation
        conversation = await this.dbService.createConversation({
          id: conversationId,
          business_id: businessId,
          status: 'active',
          assigned_agent: 'receptionist',
          created_at: new Date().toISOString()
        });
      }

      // Get business configuration
      const businessConfig = await this.dbService.getBusinessConfig(businessId);

      // Get conversation history
      const messages = await this.dbService.getConversationMessages(conversationId);

      return {
        ...conversation,
        businessConfig,
        messages,
        messageCount: messages.length
      };

    } catch (error) {
      logger.error('Error getting conversation context:', error);
      throw error;
    }
  }

  async saveMessage(conversationId, sender, content, timestamp) {
    return await this.dbService.saveMessage({
      conversation_id: conversationId,
      sender,
      content,
      message_type: 'text'
    });
  }

  async updateConversationState(conversationId, agentResponse) {
    const updates = {
      updated_at: new Date().toISOString(),
      assigned_agent: agentResponse.agentType
    };

    // Update conversation status based on agent response
    if (agentResponse.action === 'escalate_to_human') {
      updates.status = 'escalated';
    }

    if (agentResponse.leadQuality) {
      updates.lead_quality = agentResponse.leadQuality;
    }

    return await this.dbService.updateConversation(conversationId, updates);
  }

  async handleAgentActions(agentResponse, conversation) {
    switch (agentResponse.action) {
      case 'escalate_to_human':
        await this.handleEscalation(agentResponse, conversation);
        break;

      case 'collect_contact_info':
        await this.handleContactCollection(agentResponse, conversation);
        break;

      case 'schedule_callback':
        await this.handleCallbackScheduling(agentResponse, conversation);
        break;

      case 'immediate_escalation':
        await this.handleImmediateEscalation(agentResponse, conversation);
        break;
    }
  }

  async handleEscalation(agentResponse, conversation) {
    const escalationData = {
      conversation_id: conversation.id,
      business_id: conversation.business_id,
      escalation_reason: agentResponse.escalationReason,
      priority: agentResponse.priority || 'medium',
      customer_info: conversation.customer_info,
      summary: agentResponse.summary,
      created_at: new Date().toISOString()
    };

    // Save escalation to database
    await this.dbService.createEscalation(escalationData);

    // Send notification to business owner
    await this.notificationService.sendEscalationNotification(escalationData);
  }

  async handleImmediateEscalation(agentResponse, conversation) {
    const urgentEscalation = {
      ...agentResponse,
      conversation_id: conversation.id,
      business_id: conversation.business_id,
      urgency: 'HIGH',
      response_promise: '2-5 minutes'
    };

    // Send immediate notifications via multiple channels
    await Promise.all([
      this.notificationService.sendSMSAlert(urgentEscalation),
      this.notificationService.sendSlackUrgent(urgentEscalation),
      this.notificationService.sendPushNotification(urgentEscalation)
    ]);
  }

  async handleContactCollection(agentResponse, conversation) {
    // Update conversation with collected contact info
    if (agentResponse.contactData) {
      await this.dbService.updateConversation(conversation.id, {
        customer_name: agentResponse.contactData.name,
        customer_phone: agentResponse.contactData.phone,
        customer_email: agentResponse.contactData.email
      });
    }
  }

  async handleCallbackScheduling(agentResponse, conversation) {
    // Create callback task
    const callbackTask = {
      conversation_id: conversation.id,
      business_id: conversation.business_id,
      scheduled_time: agentResponse.callbackTime,
      type: 'callback',
      priority: agentResponse.priority || 'medium',
      customer_info: conversation.customer_info
    };

    await this.dbService.createTask(callbackTask);
  }

  // Enable/disable agents for specific businesses
  async configureBusinessAgents(businessId, agentConfig) {
    const enabledAgents = [];

    // Receptionist and Coordinator are always enabled
    enabledAgents.push('receptionist', 'coordinator');

    // Add optional agents based on business config
    if (agentConfig.salesAgent) {
      enabledAgents.push('sales');
    }

    if (agentConfig.businessManager) {
      enabledAgents.push('business_manager');
    }

    return await this.dbService.updateBusinessAgents(businessId, enabledAgents);
  }
}

module.exports = AgentOrchestrator;