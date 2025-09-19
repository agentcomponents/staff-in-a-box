const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// In-memory session storage (use Redis/database in production)
const sessions = new Map();

// Lead logging function with Google Sheets integration
async function logLeadToSheet(leadData) {
  try {
    // Always log to console first
    console.log('🎯 NEW LEAD COLLECTED:', {
      timestamp: new Date().toISOString(),
      name: leadData.name,
      email: leadData.email || 'Not provided',
      phone: leadData.phone || 'Not provided',
      inquiry: leadData.inquiry,
      source: 'AI Chat Widget'
    });

    // Try to log to Google Sheets if credentials are configured
    if (process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      await logToGoogleSheets(leadData);
    } else {
      console.log('📝 Google Sheets not configured - lead logged to console only');
    }

  } catch (error) {
    console.error('Error logging lead:', error);
  }
}

// Google Sheets integration using HTTP API
async function logToGoogleSheets(leadData) {
  try {
    const { JWT } = require('google-auth-library');

    // Create JWT client with improved key parsing
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    // Handle different key formats
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    // Ensure proper key format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Private key format is invalid. Make sure it includes the BEGIN/END markers.');
    }

    const jwtClient = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Get access token
    const tokens = await jwtClient.authorize();
    const accessToken = tokens.access_token;

    // Prepare the data row
    const rowData = [
      new Date().toISOString(),
      leadData.name,
      leadData.email || '',
      leadData.phone || '',
      leadData.inquiry,
      'AI Chat Widget'
    ];

    // First, check if headers exist and add them if not
    const checkResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values/Sheet1!A1:F1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const checkData = await checkResponse.json();

    // If no data in A1 or headers don't match, add headers
    if (!checkData.values || !checkData.values[0] || checkData.values[0][0] !== 'Timestamp') {
      const headerRow = ['Timestamp', 'Name', 'Email', 'Phone', 'Inquiry', 'Source'];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values/Sheet1!A1:F1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [headerRow]
        })
      });
    }

    // Make HTTP request to append data to Google Sheets
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values/Sheet1!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData]
      })
    });

    if (response.ok) {
      console.log('✅ Lead successfully logged to Google Sheets');
    } else {
      const errorText = await response.text();
      console.error('❌ Google Sheets API error:', errorText);
    }

  } catch (error) {
    console.error('❌ Error logging to Google Sheets:', error.message);
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

    // Always try to extract lead information if we haven't collected a lead yet
    if (session.hasMadeBusinessInquiry && !session.leadCollected) {
      const leadData = extractLeadInfo(message);
      if (leadData.hasContact) {
        // Merge new info with existing info
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
          // More intelligent missing info detection
          const missing = [];
          if (!session.leadInfo.name) missing.push('name');
          if (!session.leadInfo.email && !session.leadInfo.phone) missing.push('email or phone number');

          let response;
          if (leadData.name && !leadData.email && !leadData.phone) {
            response = `Thanks ${leadData.name}! Could I also get your email or phone number so we can follow up with you about your project?`;
          } else if (leadData.email && !leadData.name) {
            response = `I have your email address. Could I also get your name so we can personalize our follow-up?`;
          } else if (leadData.phone && !leadData.name) {
            response = `I have your phone number. Could I also get your name so we can personalize our follow-up?`;
          } else {
            response = `Could I get your ${missing.join(' and ')}? This helps us follow up with you properly about your project.`;
          }

          return res.json({
            response: {
              message: response,
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

CRITICAL RULES:
- NEVER make up phone numbers, emails, or any contact information
- NEVER claim you will call someone unless they've provided a phone number
- Keep responses SHORT and DIRECT
- Only state facts you know for certain

Context:
- Session state: Greeted=${session.hasGreeted}, Business inquiry=${session.hasMadeBusinessInquiry}, Lead collected=${session.leadCollected}
- Collected info: Name="${session.leadInfo.name || 'none'}", Email="${session.leadInfo.email || 'none'}", Phone="${session.leadInfo.phone || 'none'}"

Guidelines:
- Answer their actual question directly
- Keep responses under 2 sentences for non-business questions
- If they say "call me" but haven't provided a phone number, ask for their phone number
- Pricing: Simple sites $1,500-$3,000, Business sites $3,000-$8,000, E-commerce $8,000-$15,000+
- Don't ask for information you already have
- If they give unclear responses, ask clarifying questions about their website needs

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

  // Multiple name patterns
  const namePatterns = [
    /(?:my name is|i'm|i am|call me)\s+([a-zA-Z\s]{2,30})(?:\s+and|,|$)/i,
    /(?:it'?s|this is)\s+([a-zA-Z\s]{2,30})(?:\s+and|,|$)/i,
    /(?:my nae is|my nam is)\s+([a-zA-Z\s]{2,30})(?:\s+and|,|$)/i, // Handle typos
  ];

  const result = {
    hasContact: false
  };

  // Extract email
  const email = message.match(emailRegex);
  if (email) {
    result.email = email[0];
    result.hasContact = true;
  }

  // Extract phone
  const phone = message.match(phoneRegex);
  if (phone) {
    result.phone = phone[0];
    result.hasContact = true;
  }

  // Extract name using multiple patterns
  for (const pattern of namePatterns) {
    const nameMatch = message.match(pattern);
    if (nameMatch) {
      result.name = nameMatch[1].trim();
      result.hasContact = true;
      break;
    }
  }

  // Handle "Name, email@domain.com" format
  if (email && !result.name) {
    const parts = message.split(',');
    if (parts.length >= 2) {
      const potentialName = parts[0].trim();
      if (potentialName.length >= 2 && potentialName.length <= 30 && /^[a-zA-Z\s]+$/.test(potentialName)) {
        result.name = potentialName;
      }
    }
  }

  // Simple name detection for standalone names (but be more careful)
  if (!result.name && !email && !phone) {
    const trimmed = message.trim();
    const words = trimmed.split(/\s+/);

    // Check if it looks like a name (1-3 words, only letters and spaces, reasonable length)
    if (words.length >= 1 && words.length <= 3 &&
        trimmed.length >= 2 && trimmed.length <= 30 &&
        /^[a-zA-Z\s]+$/.test(trimmed) &&
        !['ok', 'yes', 'no', 'sure', 'thanks', 'hello', 'hi', 'hey'].includes(trimmed.toLowerCase())) {
      result.name = trimmed;
      result.hasContact = true;
    }
  }

  return result;
}

function getStateAwareFallbackResponse(message, session) {
  const lowerMessage = message.toLowerCase();

  // Detect bot testing/spam behavior
  const spamIndicators = ['you are human', 'are you a bot', 'what time is it', 'i like you', 'what you do'];
  const isSpammy = spamIndicators.some(indicator => lowerMessage.includes(indicator));

  // Count consecutive non-business messages
  if (!session.consecutiveNonBusiness) session.consecutiveNonBusiness = 0;

  if (isSpammy || (!isBusinessInquiry(message) && session.consecutiveNonBusiness >= 2)) {
    session.consecutiveNonBusiness++;

    if (session.consecutiveNonBusiness >= 4) {
      return "I'm here specifically to help with web development projects. If you need a website, I'm happy to assist. Otherwise, have a great day!";
    } else if (session.consecutiveNonBusiness >= 3) {
      return "I'm a virtual assistant focused on web development services. Do you have a website project I can help you with?";
    } else {
      return "I help with web development projects. Are you looking to build a website?";
    }
  }

  // Reset counter for business-related messages
  if (isBusinessInquiry(message)) {
    session.consecutiveNonBusiness = 0;
  }

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