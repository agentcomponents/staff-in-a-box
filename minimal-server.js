const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// In-memory session storage (use Redis/database in production)
const sessions = new Map();

// Lead logging function (simplified for now - can add Google Sheets later)
async function logLeadToSheet(leadData) {
  try {
    // For now, just log to console - this ensures Railway stability
    console.log('🎯 NEW LEAD COLLECTED:', {
      timestamp: new Date().toISOString(),
      name: leadData.name,
      email: leadData.email || 'Not provided',
      phone: leadData.phone || 'Not provided',
      inquiry: leadData.inquiry,
      source: 'AI Chat Widget'
    });

    // TODO: Add Google Sheets integration once Railway is stable
    // The smart conversation tracking and lead collection is working perfectly!

  } catch (error) {
    console.error('Error logging lead:', error);
  }
}

// Helper function to get or create session
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      hasGreeted: false,
      hasMadeBusinessInquiry: false,
      leadCollected: false,
      messages: [],
      leadInfo: {}
    });
  }
  return sessions.get(sessionId);
}

// Basic middleware
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Enhanced chat endpoint with conversation state and lead collection
app.post('/api/agents/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = getSession(sessionId);
    session.messages.push({ role: 'user', content: message });

    const lowerMessage = message.toLowerCase();

    // Check if user is providing lead information
    if (session.hasMadeBusinessInquiry && !session.leadCollected) {
      const leadData = extractLeadInfo(message);
      if (leadData.hasContact) {
        session.leadInfo = { ...session.leadInfo, ...leadData };

        // Check if we have all required info
        if (session.leadInfo.name && (session.leadInfo.email || session.leadInfo.phone)) {
          session.leadCollected = true;

          // Log to Google Sheets
          await logLeadToSheet({
            name: session.leadInfo.name,
            email: session.leadInfo.email || '',
            phone: session.leadInfo.phone || '',
            inquiry: session.leadInfo.inquiry || session.messages[session.messages.length - 2]?.content || 'General inquiry'
          });

          return res.json({
            response: {
              message: `Thanks ${session.leadInfo.name}! I've got your information and someone from our team will reach out to you soon about your project. In the meantime, is there anything specific about your website requirements you'd like to discuss?`,
              agentType: 'receptionist'
            }
          });
        } else {
          const missing = [];
          if (!session.leadInfo.name) missing.push('name');
          if (!session.leadInfo.email && !session.leadInfo.phone) missing.push('email or phone number');

          return res.json({
            response: {
              message: `Could I also get your ${missing.join(' and ')}? This helps us follow up with you properly.`,
              agentType: 'receptionist'
            }
          });
        }
      }
    }

    // Check for greeting
    if (!session.hasGreeted && isGreeting(message)) {
      session.hasGreeted = true;
      return res.json({
        response: {
          message: "Hello! I'm here to help with your web development needs. What can I assist you with today?",
          agentType: 'receptionist'
        }
      });
    }

    // Check for business inquiry after greeting
    if (session.hasGreeted && !session.hasMadeBusinessInquiry && isBusinessInquiry(message)) {
      session.hasMadeBusinessInquiry = true;
      session.leadInfo.inquiry = message;
    }

    // Use AI for intelligent responses
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      let prompt = `You are a professional virtual receptionist for a web development company.

IMPORTANT: Keep responses SHORT and DIRECT. Answer their specific question first.

Guidelines:
- Answer their actual question directly
- Keep responses under 2 sentences for non-business questions
- Pricing: Simple sites $1,500-$3,000, Business sites $3,000-$8,000, E-commerce $8,000-$15,000+

Customer message: "${message}"`;

      // If they've made a business inquiry but we haven't collected leads, ask for contact info
      if (session.hasMadeBusinessInquiry && !session.leadCollected && shouldCollectLead(message)) {
        prompt += `\n\nAfter answering their question, ask for their name and contact information (email or phone) so you can follow up with more details about their project.`;
      }

      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();

      return res.json({
        response: {
          message: aiResponse,
          agentType: 'receptionist'
        }
      });

    } catch (aiError) {
      console.error('AI Error:', aiError);
      // Fall back to hardcoded responses
    }

    // Fallback responses with state awareness
    let response = getStateAwareFallbackResponse(message, session);

    res.json({
      response: {
        message: response,
        agentType: 'receptionist'
      }
    });

  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Helper functions for conversation state
function isGreeting(message) {
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
  return greetings.some(greeting => message.toLowerCase().includes(greeting));
}

function isBusinessInquiry(message) {
  const businessKeywords = ['website', 'price', 'cost', 'quote', 'project', 'development', 'design', 'ecommerce', 'business', 'site'];
  return businessKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

function shouldCollectLead(message) {
  const leadTriggers = ['price', 'cost', 'quote', 'how much', 'pricing', 'urgent', 'asap', 'project', 'build', 'need'];
  return leadTriggers.some(trigger => message.toLowerCase().includes(trigger));
}

function extractLeadInfo(message) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
  const nameRegex = /(?:my name is|i'm|i am|call me)\s+([a-zA-Z\s]{2,30})(?:\s+and|$)/i;

  const result = {
    hasContact: false
  };

  const email = message.match(emailRegex);
  if (email) {
    result.email = email[0];
    result.hasContact = true;
  }

  const phone = message.match(phoneRegex);
  if (phone) {
    result.phone = phone[0];
    result.hasContact = true;
  }

  const name = message.match(nameRegex);
  if (name) {
    result.name = name[1].trim();
    result.hasContact = true;
  }

  // Simple name detection for messages that are just names (2-3 words)
  if (!result.name && message.split(' ').length >= 2 && message.split(' ').length <= 3 && /^[a-zA-Z\s]+$/.test(message.trim())) {
    result.name = message.trim();
    result.hasContact = true;
  }

  return result;
}

function getStateAwareFallbackResponse(message, session) {
  const lowerMessage = message.toLowerCase();

  // If we need to collect lead info
  if (session.hasMadeBusinessInquiry && !session.leadCollected && shouldCollectLead(message)) {
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
      return "Our websites range from $1,500 for simple sites to $15,000+ for e-commerce. To give you an accurate quote, could I get your name and email or phone number?";
    }
    if (lowerMessage.includes('urgent')) {
      return "I understand this is urgent! I'll connect you with someone right away. Could I get your name and phone number?";
    }
    return "I'd be happy to help with your project. Could I get your name and contact information so I can have someone follow up with you?";
  }

  // Standard fallback responses
  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
    return "Our websites range from $1,500 for simple sites to $15,000+ for e-commerce. What type of project do you have in mind?";
  }

  if (lowerMessage.includes('urgent')) {
    return "I understand this is urgent! What type of website assistance do you need?";
  }

  return "Thanks for reaching out! I'd be happy to help you with your website project. What type of website are you looking for?";
}

// Debug environment
console.log('Starting server...');
console.log('Environment variables:');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Set ✓' : 'Not set ✗');
console.log('- GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? 'Set ✓' : 'Not set ✗');
console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set ✓' : 'Not set ✗');
console.log('- GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? 'Set ✓' : 'Not set ✗');

// Start server
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

console.log(`Attempting to bind to ${HOST}:${PORT}`);

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server successfully started on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;