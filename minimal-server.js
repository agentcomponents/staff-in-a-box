const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic chat endpoint for testing
app.post('/api/agents/chat', (req, res) => {
  const { message } = req.body;

  // Simple demo response
  let response = "Thanks for reaching out! I'd be happy to help you with your website project. What type of website are you looking for?";

  if (message && message.toLowerCase().includes('price')) {
    response = "I'd rather give you a total project cost upfront so there's no confusion. What type of website are you looking for - a simple one-page site, business website, or e-commerce store? Projects typically range from $1,500 for simple sites to $15,000+ for complex e-commerce.";
  }

  if (message && message.toLowerCase().includes('urgent')) {
    response = "I understand this is urgent! To get you immediate assistance, I need to connect you with someone right away. Could I get your name and phone number so our team can reach you within the next few minutes?";
  }

  res.json({
    response: {
      message: response,
      agentType: 'receptionist'
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;