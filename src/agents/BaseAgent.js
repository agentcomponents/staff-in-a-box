const logger = require('../utils/logger');

class BaseAgent {
  constructor(agentType, dbService, notificationService) {
    this.agentType = agentType;
    this.dbService = dbService;
    this.notificationService = notificationService;
    this.logger = logger;
  }

  async processMessage(message, conversation) {
    throw new Error('processMessage must be implemented by subclass');
  }

  async updateConversationData(conversationId, data) {
    try {
      return await this.dbService.updateConversation(conversationId, data);
    } catch (error) {
      this.logger.error(`Error updating conversation data for ${this.agentType}:`, error);
      throw error;
    }
  }

  assessUrgency(message) {
    const urgencyKeywords = ['urgent', 'asap', 'emergency', 'immediate', 'now', 'help'];
    const lowerMessage = message.toLowerCase();

    return urgencyKeywords.some(keyword => lowerMessage.includes(keyword)) ? 'high' : 'medium';
  }

  logActivity(conversationId, activity, metadata = {}) {
    this.logger.info(`Agent ${this.agentType} activity`, {
      conversationId,
      activity,
      metadata,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = BaseAgent;