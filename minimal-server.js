const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

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

// Chat endpoint with AI integration
app.post('/api/agents/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Try Google Gemini AI first
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are a professional virtual receptionist for a web development company. Your role is to:

1. Greet customers warmly and professionally
2. Gather basic project requirements
3. Provide initial pricing estimates:
   - Simple websites: $1,500-$3,000
   - Business websites: $3,000-$8,000
   - E-commerce sites: $8,000-$15,000+
4. Collect contact information when customers show serious interest
5. Escalate urgent matters or qualified leads to human staff

For urgent inquiries, prioritize connecting them with human staff immediately.

Customer message: "${message}"

Respond as a professional receptionist would, being helpful and knowledgeable about web development services.`;

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
      // Fall back to hardcoded responses if AI fails
    }

    // Fallback responses
    let response = "Thanks for reaching out! I'd be happy to help you with your website project. What type of website are you looking for?";

    const lowerMessage = message.toLowerCase();

    // Pricing inquiries
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much') || lowerMessage.includes('pricing')) {
      response = "I'd rather give you a total project cost upfront so there's no confusion. What type of website are you looking for - a simple one-page site, business website, or e-commerce store? Projects typically range from $1,500 for simple sites to $15,000+ for complex e-commerce.";
    }

    // Urgency handling
    if (lowerMessage.includes('urgent') || lowerMessage.includes('asap') || lowerMessage.includes('emergency') || lowerMessage.includes('rush')) {
      response = "I understand this is urgent! To get you immediate assistance, I need to connect you with someone right away. Could I get your name and phone number so our team can reach you within the next few minutes?";
    }

    // Off-topic questions
    if (lowerMessage.includes('sky') || lowerMessage.includes('weather') || lowerMessage.includes('color') || lowerMessage.includes('football') || lowerMessage.includes('news')) {
      response = "I appreciate your question, but I'm here specifically to help with website development projects. Is there anything about creating a website for your business that I can help you with today?";
    }

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

// Debug environment
console.log('Starting server...');
console.log('Environment variables:');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Set ✓' : 'Not set ✗');

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