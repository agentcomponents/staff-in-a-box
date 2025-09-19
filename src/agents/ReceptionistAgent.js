const BaseAgent = require('./BaseAgent');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class ReceptionistAgent extends BaseAgent {
  constructor(dbService, notificationService) {
    super('receptionist', dbService, notificationService);
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Initialize Google Gemini for free AI responses
    this.gemini = process.env.GOOGLE_AI_API_KEY ?
      new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY) : null;

    // Escalation triggers for web design business
    this.escalationTriggers = [
      'changes to my existing site',
      'modify my current',
      'update my website',
      'add to my site',
      'crypto payment',
      'payment gateway',
      'specific functionality',
      'custom feature',
      'how would you implement',
      'what technology',
      'database structure',
      'API integration'
    ];
  }

  async processMessage(message, conversation) {
    try {
      const analysis = await this.analyzeMessage(message, conversation);

      // Check if this requires escalation
      if (analysis.requiresEscalation) {
        return await this.handleEscalation(message, analysis, conversation);
      }

      // Handle different types of inquiries
      switch (analysis.inquiryType) {
        case 'pricing':
          return await this.handlePricingInquiry(message, analysis, conversation);
        case 'services':
          return await this.handleGeneralResponse(message, conversation);
        case 'timeline':
          return await this.handleTimelineInquiry(message, analysis, conversation);
        case 'contact_info':
          return await this.processContactInfo(message, conversation);
        case 'urgency_assessment':
          return await this.handleUrgencyAssessment(message, conversation);
        default:
          // Handle off-topic questions with AI response
          if (analysis.isOffTopic && analysis.aiResponse) {
            return {
              agentType: 'receptionist',
              message: analysis.aiResponse,
              action: 'off_topic_redirect',
              leadQuality: 'cold'
            };
          }

          // Check if we need to collect contact info for non-specific inquiries
          if (analysis.needsContactInfo && !conversation.hasContactInfo) {
            return await this.handleContactCollection(message, conversation);
          }

          // Use AI response for general inquiries if available
          if (analysis.aiResponse) {
            return {
              agentType: 'receptionist',
              message: analysis.aiResponse,
              action: 'ai_general_response',
              leadQuality: 'warm'
            };
          }

          return await this.handleGeneralResponse(message, conversation);
      }

    } catch (error) {
      this.logger.error('Error processing message in ReceptionistAgent:', error);
      return this.getErrorResponse();
    }
  }

  async analyzeMessage(message, conversation) {
    const lowerMessage = message.toLowerCase();

    // Check for escalation triggers
    const escalationMatch = this.escalationTriggers.find(trigger =>
      lowerMessage.includes(trigger)
    );

    if (escalationMatch) {
      return {
        requiresEscalation: true,
        escalationReason: 'specific_modification_request',
        needsContactInfo: true,
        inquiryType: 'escalation'
      };
    }

    // Use AI to analyze the message context and intent
    const aiAnalysis = await this.analyzeMessageWithAI(message, conversation);

    // Determine inquiry type (fallback to keyword matching if AI analysis fails)
    const inquiryType = aiAnalysis.inquiryType || this.classifyInquiry(lowerMessage);

    // Check if we need contact info for this type of inquiry
    const needsContactInfo = this.requiresContactInfo(inquiryType, conversation);

    return {
      requiresEscalation: false,
      inquiryType,
      needsContactInfo,
      projectType: aiAnalysis.projectType || this.identifyProjectType(lowerMessage),
      urgencyLevel: aiAnalysis.urgencyLevel || this.assessUrgency(lowerMessage),
      isOffTopic: aiAnalysis.isOffTopic || false,
      aiResponse: aiAnalysis.response
    };
  }

  classifyInquiry(message) {
    const patterns = {
      pricing: ['cost', 'price', 'budget', 'how much', 'rate', 'hourly'],
      services: ['do you do', 'can you', 'services', 'what do you offer'],
      timeline: ['how long', 'when', 'timeline', 'deadline'],
      contact_info: ['my name is', 'i\'m', 'call me', 'email me'],
      urgency_assessment: ['right now', 'immediately', 'urgent', 'asap', 'quickly', 'later', 'callback']
    };

    for (const [type, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        return type;
      }
    }

    return 'general';
  }

  identifyProjectType(message) {
    const projectTypes = {
      'one_page': ['one page', 'single page', 'landing page', 'simple site'],
      'ecommerce': ['online store', 'e-commerce', 'sell products', 'shopping cart'],
      'redesign': ['redesign', 'rebuild', 'complete overhaul', 'start over'],
      'new_website': ['new website', 'build a site', 'create a website', 'from scratch']
    };

    for (const [type, keywords] of Object.entries(projectTypes)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        return type;
      }
    }

    return 'unknown';
  }

  requiresContactInfo(inquiryType, conversation) {
    // These inquiry types need contact info before proceeding
    const contactRequiredTypes = ['escalation', 'pricing', 'services'];
    return contactRequiredTypes.includes(inquiryType) && !conversation.customer_name;
  }

  async handleEscalation(message, analysis, conversation) {
    if (!conversation.customer_name) {
      return {
        agentType: 'receptionist',
        message: "That's a great question about specific modifications! Since every existing site is different, I'd like to have our developer take a look at your current setup to give you an accurate quote. Could I get your name and best contact number so they can reach you?",
        action: 'collect_contact_info',
        nextStep: 'collect_name',
        escalationPending: true,
        leadQuality: 'hot'
      };
    }

    // Contact info collected, now assess urgency
    return {
      agentType: 'receptionist',
      message: `Perfect! I can try to find someone who can better answer that question for you. Are you looking to speak with someone right now, or would you prefer to have someone get back to you later today?`,
      action: 'assess_urgency',
      escalationReason: analysis.escalationReason,
      originalInquiry: message,
      leadQuality: 'hot'
    };
  }

  async handleContactCollection(message, conversation) {
    const stage = conversation.contactCollectionStage || 'collect_name';

    switch (stage) {
      case 'collect_name':
        if (this.validateName(message)) {
          await this.updateConversationData(conversation.id, { customer_name: message.trim() });
          return {
            agentType: 'receptionist',
            message: `Thank you, ${message.trim()}! And what's the best phone number to reach you at?`,
            action: 'collect_contact_info',
            nextStep: 'collect_phone',
            contactData: { name: message.trim() }
          };
        } else {
          return {
            agentType: 'receptionist',
            message: "I didn't catch that. Could you tell me your name?",
            action: 'collect_contact_info',
            nextStep: 'collect_name',
            retry: true
          };
        }

      case 'collect_phone':
        if (this.validatePhone(message)) {
          await this.updateConversationData(conversation.id, { customer_phone: message.trim() });
          return {
            agentType: 'receptionist',
            message: `Got it! And your email address so we can send follow-up information?`,
            action: 'collect_contact_info',
            nextStep: 'collect_email',
            contactData: { phone: message.trim() }
          };
        } else {
          return {
            agentType: 'receptionist',
            message: "Could you double-check that phone number? I want to make sure we can reach you.",
            action: 'collect_contact_info',
            nextStep: 'collect_phone',
            retry: true
          };
        }

      case 'collect_email':
        if (this.validateEmail(message)) {
          await this.updateConversationData(conversation.id, {
            customer_email: message.trim(),
            hasContactInfo: true
          });
          return {
            agentType: 'receptionist',
            message: `Perfect! I have your information. Let me see who's available to discuss your project.`,
            action: 'assess_urgency',
            contactComplete: true,
            contactData: { email: message.trim() },
            leadQuality: 'warm'
          };
        } else {
          return {
            agentType: 'receptionist',
            message: "Could you check that email address? I want to make sure our follow-up reaches you.",
            action: 'collect_contact_info',
            nextStep: 'collect_email',
            retry: true
          };
        }
    }
  }

  async handlePricingInquiry(message, analysis, conversation) {
    const baseResponse = "I'd rather give you a total project cost upfront so there's no confusion or hassle calculating hours. ";

    const projectResponses = {
      'one_page': {
        question: "Are you looking for a simple one-page site or something more comprehensive?",
        priceRange: "Simple one-page sites typically range from $1,500-$3,500"
      },
      'ecommerce': {
        question: "What type of e-commerce site are you considering?",
        priceRange: "E-commerce sites typically range from $5,000-$15,000 depending on features"
      },
      'new_website': {
        question: "What type of website are you looking for? A simple business site or something more complex?",
        priceRange: "Business websites typically range from $3,000-$10,000"
      },
      'redesign': {
        question: "What type of redesign are you considering - complete rebuild or working with your existing content?",
        priceRange: "Complete redesigns typically range from $4,000-$12,000"
      }
    };

    const response = projectResponses[analysis.projectType] || {
      question: "What type of website are you looking for - a simple one-page site, business website, or e-commerce store?",
      priceRange: "Projects typically range from $1,500 for simple sites to $15,000+ for complex e-commerce"
    };

    return {
      agentType: 'receptionist',
      message: `${baseResponse}${response.question}\n\n${response.priceRange} to give you a ballpark, but I can provide a more accurate estimate once I understand your specific needs.`,
      action: 'await_project_details',
      leadQuality: analysis.projectType === 'unknown' ? 'cold' : 'warm'
    };
  }

  async handleUrgencyAssessment(message, conversation) {
    const urgencyLevel = this.classifyUrgency(message);

    // If urgent but no contact info, collect it first
    if (!conversation.customer_name && urgencyLevel === 'immediate') {
      return {
        agentType: 'receptionist',
        message: "I understand this is urgent! To get you immediate assistance, I need to connect you with someone right away. Could I get your name and phone number so our team can reach you within the next few minutes?",
        action: 'collect_contact_info',
        nextStep: 'collect_name',
        escalationPending: true,
        urgency: 'immediate',
        leadQuality: 'hot'
      };
    }

    switch (urgencyLevel) {
      case 'immediate':
        return {
          agentType: 'receptionist',
          message: `I'm checking to see who's available right now. I'll have someone reach out to you at ${conversation.customer_phone} within the next few minutes. If no one is immediately available, we'll definitely get back to you within a couple hours.`,
          action: 'immediate_escalation',
          priority: 'high',
          urgency: 'immediate',
          customerInfo: {
            name: conversation.customer_name,
            phone: conversation.customer_phone,
            email: conversation.customer_email
          },
          leadQuality: 'hot'
        };

      case 'callback':
        return {
          agentType: 'receptionist',
          message: `Perfect! I'll have someone get back to you later today or tomorrow morning at ${conversation.customer_phone}. You'll also receive a follow-up email at ${conversation.customer_email} with some initial information.`,
          action: 'schedule_callback',
          priority: 'medium',
          callbackTime: this.calculateCallbackTime(),
          leadQuality: 'warm'
        };

      default:
        return {
          agentType: 'receptionist',
          message: `Thanks for the information! Someone will be in touch with you soon to discuss your project in detail.`,
          action: 'standard_follow_up',
          priority: 'medium',
          leadQuality: 'warm'
        };
    }
  }

  classifyUrgency(message) {
    const immediateKeywords = ['now', 'right now', 'immediately', 'urgent', 'asap', 'waiting'];
    const callbackKeywords = ['later', 'callback', 'call back', 'tomorrow', 'this week'];

    const lowerMessage = message.toLowerCase();

    if (immediateKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'immediate';
    } else if (callbackKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'callback';
    }

    return 'flexible';
  }

  // Validation methods
  validateName(input) {
    return input && input.trim().length > 1 && !/^\d+$/.test(input);
  }

  validatePhone(input) {
    const phoneRegex = /[\d\s\-\(\)\+]{10,}/;
    return phoneRegex.test(input);
  }

  validateEmail(input) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  }

  calculateCallbackTime() {
    const now = new Date();
    now.setHours(now.getHours() + 4); // 4 hours from now
    return now.toISOString();
  }

  async analyzeMessageWithAI(message, conversation) {
    try {
      this.logger.info('Starting AI analysis', {
        hasGemini: !!this.gemini,
        geminiKeyExists: !!process.env.GOOGLE_AI_API_KEY,
        messagePreview: message.substring(0, 50)
      });

      // Try Google Gemini first (free tier)
      if (this.gemini) {
        this.logger.info('Using Gemini for analysis');
        return await this.analyzeWithGemini(message, conversation);
      }

      this.logger.info('No Gemini available, using demo mode');
      // Fallback to demo mode if no AI provider available
      return this.getDemoResponse(message, conversation);

    } catch (error) {
      this.logger.error('AI analysis failed:', error);
      // Fallback to demo mode on error
      return this.getDemoResponse(message, conversation);
    }
  }

  async analyzeWithGemini(message, conversation) {
    try {
      this.logger.info('Using Google Gemini for AI analysis', { message: message.substring(0, 50) });

      const contextInfo = this.buildConversationContext(conversation);
      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are a professional receptionist for a web design business. Analyze this customer message and respond appropriately.

Business Context:
- We specialize in website design and development
- Services: One-page sites ($1,500-$3,500), Business websites ($3,000-$10,000), E-commerce ($5,000-$15,000)
- We need to qualify leads and collect contact information for serious inquiries

Customer Message: "${message}"

${contextInfo}

Instructions:
1. If the message is completely off-topic (like "where am i?" or "is the sky blue?"), acknowledge it briefly but redirect to web design services professionally
2. If it's business-related, provide helpful information and guide toward next steps
3. Keep responses conversational, helpful, and professional
4. Don't ask for contact info in your response - that's handled separately

Respond with ONLY a JSON object (no markdown formatting):
{
  "inquiryType": "pricing|services|timeline|contact_info|urgency_assessment|general",
  "projectType": "one_page|ecommerce|redesign|new_website|unknown",
  "urgencyLevel": "immediate|callback|flexible",
  "isOffTopic": true,
  "response": "That's an interesting question! While I can't help with general topics, I'd be happy to discuss how we can help with your website needs. Are you looking for web design or development services?"
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      this.logger.info('Gemini response received', {
        responseLength: responseText.length,
        preview: responseText.substring(0, 100)
      });

      // Clean up the response and parse JSON
      const cleanResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);

      this.logger.info('Gemini analysis successful', {
        inquiryType: parsed.inquiryType,
        isOffTopic: parsed.isOffTopic
      });

      return parsed;

    } catch (error) {
      this.logger.error('Gemini analysis failed:', error);
      return this.getDemoResponse(message, conversation);
    }
  }

  getDemoResponse(message, conversation) {
    const lowerMessage = message.toLowerCase();

    // Detect off-topic questions
    const offTopicPatterns = [
      'sky blue', 'weather', 'time', 'date', 'color', 'food', 'movie', 'music',
      'sports', 'politics', 'news', 'health', 'animals', 'cooking', 'travel'
    ];

    const isOffTopic = offTopicPatterns.some(pattern => lowerMessage.includes(pattern));

    if (isOffTopic) {
      return {
        inquiryType: 'general',
        projectType: 'unknown',
        urgencyLevel: 'flexible',
        isOffTopic: true,
        response: "That's an interesting question! While I can't help with general topics, I'd be happy to discuss how we can help with your website needs. Are you looking for web design or development services?"
      };
    }

    // Business-related responses
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
      return {
        inquiryType: 'pricing',
        projectType: this.identifyProjectType(lowerMessage),
        urgencyLevel: 'flexible',
        isOffTopic: false,
        response: null // Let the pricing handler take care of this
      };
    }

    if (lowerMessage.includes('urgent') || lowerMessage.includes('asap') || lowerMessage.includes('immediately')) {
      return {
        inquiryType: 'urgency_assessment',
        projectType: 'unknown',
        urgencyLevel: 'immediate',
        isOffTopic: false,
        response: null // Let the urgency handler take care of this
      };
    }

    // General business inquiry
    return {
      inquiryType: 'general',
      projectType: this.identifyProjectType(lowerMessage),
      urgencyLevel: 'flexible',
      isOffTopic: false,
      response: "Thanks for reaching out! I'd be happy to help you with your website project. What type of website are you looking to create?"
    };
  }

  buildConversationContext(conversation) {
    if (!conversation) return "This is a new conversation.";

    let context = `Conversation context:\n`;
    if (conversation.customer_name) context += `- Customer name: ${conversation.customer_name}\n`;
    if (conversation.customer_phone) context += `- Has provided phone number\n`;
    if (conversation.customer_email) context += `- Has provided email\n`;
    if (conversation.messageCount) context += `- This is message #${conversation.messageCount + 1} in the conversation\n`;

    return context;
  }

  async handleGeneralResponse(message, conversation) {
    return {
      agentType: 'receptionist',
      message: "Thanks for reaching out! I'd be happy to help you with your project. Could you tell me a bit more about what you're looking for?",
      action: 'await_clarification',
      leadQuality: 'warm'
    };
  }

  getErrorResponse() {
    return {
      agentType: 'receptionist',
      message: "I apologize, I'm having a technical issue right now. Could you please try your message again, or would you prefer to speak with someone directly?",
      action: 'error_recovery',
      priority: 'medium'
    };
  }
}

module.exports = ReceptionistAgent;