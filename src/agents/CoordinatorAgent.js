const BaseAgent = require('./BaseAgent');

class CoordinatorAgent extends BaseAgent {
  constructor(dbService, notificationService) {
    super('coordinator', dbService, notificationService);
  }

  async analyzeMessage(message, conversation) {
    try {
      // Simple routing logic for MVP
      const messageType = this.classifyMessage(message, conversation);

      // Determine which agent should handle this message
      const routingDecision = this.routeMessage(messageType, conversation);

      this.logActivity(conversation.id, 'message_routing', {
        messageType,
        assignedAgent: routingDecision.assignedAgent,
        reasoning: routingDecision.reasoning
      });

      return routingDecision;
    } catch (error) {
      this.logger.error('Error in CoordinatorAgent.analyzeMessage:', error);
      return {
        assignedAgent: 'receptionist',
        reasoning: 'fallback_to_receptionist_on_error'
      };
    }
  }

  classifyMessage(message, conversation) {
    const lowerMessage = message.toLowerCase();

    // Check conversation history for context
    const messageCount = conversation.messageCount || 0;
    const currentStage = conversation.contact_collection_stage;

    // If we're in contact collection flow
    if (currentStage && currentStage !== 'complete') {
      return 'contact_collection_flow';
    }

    // Classify based on content
    if (this.isPricingInquiry(lowerMessage)) {
      return 'pricing_inquiry';
    }

    if (this.isServiceInquiry(lowerMessage)) {
      return 'service_inquiry';
    }

    if (this.isEscalationRequired(lowerMessage)) {
      return 'escalation_required';
    }

    if (this.isUrgencyAssessment(lowerMessage)) {
      return 'urgency_assessment';
    }

    // First message in conversation
    if (messageCount === 0) {
      return 'initial_inquiry';
    }

    return 'general_inquiry';
  }

  routeMessage(messageType, conversation) {
    // All messages go to receptionist for MVP
    // Later we can add more sophisticated routing

    switch (messageType) {
      case 'escalation_required':
        return {
          assignedAgent: 'receptionist',
          reasoning: 'escalation_needs_human_handoff',
          requiresEscalation: true
        };

      case 'pricing_inquiry':
        return {
          assignedAgent: 'receptionist',
          reasoning: 'pricing_requires_qualification',
          requiresContactInfo: true
        };

      case 'sales_opportunity':
        // In future, route to sales agent
        return {
          assignedAgent: 'receptionist',
          reasoning: 'sales_opportunity_identified',
          flagForSales: true
        };

      default:
        return {
          assignedAgent: 'receptionist',
          reasoning: 'default_routing_to_receptionist'
        };
    }
  }

  isPricingInquiry(message) {
    const pricingKeywords = ['cost', 'price', 'budget', 'how much', 'rate', 'hourly', 'quote'];
    return pricingKeywords.some(keyword => message.includes(keyword));
  }

  isServiceInquiry(message) {
    const serviceKeywords = ['do you do', 'can you', 'services', 'what do you offer', 'capabilities'];
    return serviceKeywords.some(keyword => message.includes(keyword));
  }

  isEscalationRequired(message) {
    const escalationKeywords = [
      'existing site', 'modify my current', 'update my website',
      'add to my site', 'crypto payment', 'specific functionality',
      'how would you implement', 'technical question'
    ];
    return escalationKeywords.some(keyword => message.includes(keyword));
  }

  isUrgencyAssessment(message) {
    const urgencyKeywords = ['right now', 'immediately', 'later', 'callback', 'schedule'];
    return urgencyKeywords.some(keyword => message.includes(keyword));
  }

  // Agent provisioning recommendations (for future use)
  async analyzeBusinessNeeds(businessId) {
    try {
      // Analyze conversation patterns to recommend new agents
      const stats = await this.dbService.getConversationStats(businessId);

      const recommendations = [];

      // If lots of sales opportunities, recommend sales agent
      if (stats.by_lead_quality?.hot > 10) {
        recommendations.push({
          agentType: 'sales',
          reason: 'high_volume_qualified_leads',
          priority: 'medium'
        });
      }

      // If high escalation rate, recommend business manager
      if (stats.by_status?.escalated > 20) {
        recommendations.push({
          agentType: 'business_manager',
          reason: 'high_escalation_rate',
          priority: 'high'
        });
      }

      return recommendations;
    } catch (error) {
      this.logger.error('Error analyzing business needs:', error);
      return [];
    }
  }

  async processMessage(message, conversation) {
    // Coordinator doesn't directly respond to customers
    // It just provides routing analysis
    return {
      agentType: 'coordinator',
      message: null,
      action: 'routing_analysis_complete',
      routing: await this.analyzeMessage(message, conversation)
    };
  }
}

module.exports = CoordinatorAgent;