const BaseAgent = require('./BaseAgent');

class SalesAgent extends BaseAgent {
  constructor(dbService, notificationService) {
    super('sales', dbService, notificationService);
  }

  async processMessage(message, conversation) {
    try {
      // Sales agent analyzes conversations for opportunities
      // For MVP, it mainly provides insights and recommendations

      const opportunity = await this.analyzeOpportunity(message, conversation);

      if (opportunity.shouldEngage) {
        return await this.generateSalesResponse(opportunity, conversation);
      }

      // No direct sales response needed
      return {
        agentType: 'sales',
        message: null,
        action: 'opportunity_analyzed',
        opportunity,
        recommendations: opportunity.recommendations
      };

    } catch (error) {
      this.logger.error('Error in SalesAgent.processMessage:', error);
      return {
        agentType: 'sales',
        message: null,
        action: 'analysis_error',
        error: error.message
      };
    }
  }

  async analyzeOpportunity(message, conversation) {
    const lowerMessage = message.toLowerCase();

    // Lead qualification scoring
    const qualificationScore = this.calculateLeadScore(message, conversation);

    // Detect buying signals
    const buyingSignals = this.detectBuyingSignals(lowerMessage);

    // Identify upsell opportunities
    const upsellOpportunities = this.identifyUpsellOpportunities(lowerMessage);

    // Competitive analysis
    const competitorMentions = this.detectCompetitorMentions(lowerMessage);

    return {
      qualificationScore,
      buyingSignals,
      upsellOpportunities,
      competitorMentions,
      shouldEngage: qualificationScore > 70,
      recommendations: this.generateRecommendations(qualificationScore, buyingSignals)
    };
  }

  calculateLeadScore(message, conversation) {
    let score = 50; // Base score

    const lowerMessage = message.toLowerCase();

    // Budget indicators (+20)
    const budgetSignals = ['budget', 'investment', 'approved', 'ready to spend'];
    if (budgetSignals.some(signal => lowerMessage.includes(signal))) {
      score += 20;
    }

    // Urgency indicators (+15)
    const urgencySignals = ['need soon', 'launching', 'deadline', 'asap'];
    if (urgencySignals.some(signal => lowerMessage.includes(signal))) {
      score += 15;
    }

    // Authority indicators (+15)
    const authoritySignals = ['business owner', 'decision maker', 'can decide', 'my company'];
    if (authoritySignals.some(signal => lowerMessage.includes(signal))) {
      score += 15;
    }

    // Specific requirements (+10)
    const requirementSignals = ['need features', 'must have', 'requirements', 'specifications'];
    if (requirementSignals.some(signal => lowerMessage.includes(signal))) {
      score += 10;
    }

    // Project scope indicators
    if (lowerMessage.includes('ecommerce') || lowerMessage.includes('online store')) {
      score += 10; // Higher value projects
    }

    if (lowerMessage.includes('simple') || lowerMessage.includes('basic')) {
      score -= 5; // Lower value projects
    }

    return Math.min(100, Math.max(0, score));
  }

  detectBuyingSignals(message) {
    const signals = [];

    const buyingKeywords = {
      'ready_to_start': ['ready to start', 'when can we begin', 'next steps'],
      'budget_approved': ['budget approved', 'have funding', 'ready to invest'],
      'timeline_urgency': ['need asap', 'launching soon', 'deadline'],
      'comparing_options': ['comparing', 'other quotes', 'deciding between'],
      'decision_authority': ['can decide', 'business owner', 'final decision']
    };

    for (const [signal, keywords] of Object.entries(buyingKeywords)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        signals.push(signal);
      }
    }

    return signals;
  }

  identifyUpsellOpportunities(message) {
    const opportunities = [];

    const upsellMap = {
      'basic_website': {
        mentions: ['simple site', 'basic website', 'one page'],
        upsells: ['seo_optimization', 'maintenance_plan', 'analytics_setup']
      },
      'ecommerce': {
        mentions: ['online store', 'sell products', 'ecommerce'],
        upsells: ['payment_gateways', 'inventory_management', 'marketing_automation']
      },
      'existing_site': {
        mentions: ['current site', 'existing website', 'my site'],
        upsells: ['redesign', 'performance_optimization', 'mobile_optimization']
      }
    };

    for (const [projectType, config] of Object.entries(upsellMap)) {
      if (config.mentions.some(mention => message.includes(mention))) {
        opportunities.push({
          projectType,
          suggestedUpsells: config.upsells
        });
      }
    }

    return opportunities;
  }

  detectCompetitorMentions(message) {
    const competitors = {
      'wix': ['wix', 'wix.com'],
      'squarespace': ['squarespace', 'square space'],
      'wordpress': ['wordpress', 'wp'],
      'shopify': ['shopify'],
      'webflow': ['webflow'],
      'local_agency': ['other developer', 'another company', 'local agency']
    };

    const mentions = [];

    for (const [competitor, keywords] of Object.entries(competitors)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        mentions.push(competitor);
      }
    }

    return mentions;
  }

  generateRecommendations(score, buyingSignals) {
    const recommendations = [];

    if (score > 80) {
      recommendations.push({
        action: 'priority_follow_up',
        message: 'High-quality lead - recommend immediate personal contact',
        timing: 'within_2_hours'
      });
    } else if (score > 60) {
      recommendations.push({
        action: 'warm_follow_up',
        message: 'Qualified lead - send portfolio and schedule consultation',
        timing: 'within_24_hours'
      });
    } else if (score > 40) {
      recommendations.push({
        action: 'nurture_sequence',
        message: 'Potential lead - add to email sequence and follow up in 1 week',
        timing: 'weekly_follow_up'
      });
    }

    if (buyingSignals.includes('ready_to_start')) {
      recommendations.push({
        action: 'send_contract',
        message: 'Customer ready to proceed - prepare proposal/contract',
        timing: 'immediate'
      });
    }

    if (buyingSignals.includes('comparing_options')) {
      recommendations.push({
        action: 'competitive_differentiation',
        message: 'Customer comparing options - highlight unique value proposition',
        timing: 'within_4_hours'
      });
    }

    return recommendations;
  }

  async generateSalesResponse(opportunity, conversation) {
    // For MVP, sales agent provides recommendations rather than direct responses
    // In future versions, it could generate actual customer-facing content

    const { qualificationScore, buyingSignals, recommendations } = opportunity;

    if (qualificationScore > 80 && buyingSignals.length > 0) {
      return {
        agentType: 'sales',
        message: null, // No direct customer message for MVP
        action: 'high_value_opportunity',
        priority: 'high',
        recommendations: recommendations,
        suggestedActions: [
          'Schedule immediate consultation',
          'Prepare custom proposal',
          'Send portfolio of similar projects'
        ]
      };
    }

    return {
      agentType: 'sales',
      message: null,
      action: 'opportunity_monitoring',
      recommendations: recommendations
    };
  }

  // Future: Content generation capabilities
  async generateMarketingContent(businessId, contentType) {
    // Placeholder for future marketing content generation
    // Could generate social media posts, email campaigns, etc.

    return {
      contentType,
      status: 'not_implemented_in_mvp',
      message: 'Marketing content generation coming in Phase 2'
    };
  }
}

module.exports = SalesAgent;