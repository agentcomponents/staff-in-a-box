const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// In-memory session storage (use Redis/database in production)
const sessions = new Map();

// In-memory lead storage with timestamps
const leads = [];

// Owner notification settings
let notificationSettings = {
  enabled: true,
  frequency: 'hourly', // hourly, daily, twice-daily, weekly
  ownerEmail: process.env.OWNER_EMAIL || 'owner@example.com',
  lastSent: new Date()
};

// Email service setup
let emailTransporter = null;

if (process.env.EMAIL_SERVICE && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  emailTransporter = nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('📧 Email service configured');
} else {
  console.log('📧 Email service not configured - notifications will be logged only');
}

// Lead logging function with Google Sheets integration
async function logLeadToSheet(leadData) {
  try {
    const lead = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      name: leadData.name,
      email: leadData.email || 'Not provided',
      phone: leadData.phone || 'Not provided',
      inquiry: leadData.inquiry,
      source: 'AI Chat Widget',
      status: 'new'
    };

    // Store in memory
    leads.push(lead);

    // Keep only last 1000 leads to prevent memory issues
    if (leads.length > 1000) {
      leads.shift();
    }

    // Always log to console first
    console.log('🎯 NEW LEAD COLLECTED:', lead);

    // Send immediate email notification if enabled
    if (notificationSettings.enabled && emailTransporter) {
      await sendImmediateLeadNotification(lead);
    }

    // Try to log to Google Sheets if credentials are configured
    if (process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      await logToGoogleSheets(leadData);
    } else {
      console.log('📝 Google Sheets not configured - lead logged to memory only');
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

// Email notification functions
async function sendImmediateLeadNotification(lead) {
  if (!emailTransporter) return;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: notificationSettings.ownerEmail,
    subject: `🚨 New Lead: ${lead.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #007AFF;">🎯 New Lead Alert!</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Contact Information</h3>
          <p><strong>Name:</strong> ${lead.name}</p>
          <p><strong>Email:</strong> ${lead.email}</p>
          <p><strong>Phone:</strong> ${lead.phone}</p>
          <p><strong>Time:</strong> ${new Date(lead.timestamp).toLocaleString()}</p>
        </div>
        <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0066cc;">Project Inquiry</h3>
          <p style="font-style: italic;">"${lead.inquiry}"</p>
        </div>
        <p style="color: #666; font-size: 14px;">
          This lead was captured by your AI receptionist on your website.
          <br>Source: ${lead.source}
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.DASHBOARD_URL || 'https://staff-in-a-box-production.up.railway.app'}/dashboard"
             style="background: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Dashboard
          </a>
        </div>
      </div>
    `
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`📧 Immediate lead notification sent to ${notificationSettings.ownerEmail}`);
  } catch (error) {
    console.error('❌ Error sending immediate lead notification:', error.message);
  }
}

async function sendPeriodicReport() {
  if (!emailTransporter || !notificationSettings.enabled) return;

  const now = new Date();
  const timeFrame = getTimeFrameForFrequency(notificationSettings.frequency);
  const recentLeads = leads.filter(lead => {
    const leadTime = new Date(lead.timestamp);
    return leadTime >= timeFrame.start && leadTime <= now;
  });

  if (recentLeads.length === 0) {
    console.log('📧 No new leads for periodic report');
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: notificationSettings.ownerEmail,
    subject: `📊 Lead Report: ${recentLeads.length} new leads in the last ${timeFrame.label}`,
    html: generateReportHTML(recentLeads, timeFrame)
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    notificationSettings.lastSent = now;
    console.log(`📧 Periodic report sent to ${notificationSettings.ownerEmail} (${recentLeads.length} leads)`);
  } catch (error) {
    console.error('❌ Error sending periodic report:', error.message);
  }
}

function getTimeFrameForFrequency(frequency) {
  const now = new Date();
  let start, label;

  switch (frequency) {
    case 'hourly':
      start = new Date(now - 60 * 60 * 1000);
      label = 'hour';
      break;
    case 'twice-daily':
      start = new Date(now - 12 * 60 * 60 * 1000);
      label = '12 hours';
      break;
    case 'daily':
      start = new Date(now - 24 * 60 * 60 * 1000);
      label = 'day';
      break;
    case 'weekly':
      start = new Date(now - 7 * 24 * 60 * 60 * 1000);
      label = 'week';
      break;
    default:
      start = new Date(now - 60 * 60 * 1000);
      label = 'hour';
  }

  return { start, label };
}

function generateReportHTML(recentLeads, timeFrame) {
  const totalLeads = leads.length;
  const conversionRate = recentLeads.length > 0 ? ((recentLeads.filter(l => l.phone !== 'Not provided' || l.email !== 'Not provided').length / recentLeads.length) * 100).toFixed(1) : 0;

  let leadsHTML = recentLeads.map(lead => `
    <div style="border-left: 4px solid #007AFF; padding: 15px; margin: 10px 0; background: #f8f9fa;">
      <h4 style="margin: 0 0 10px 0; color: #333;">${lead.name}</h4>
      <p style="margin: 5px 0; color: #666;"><strong>Contact:</strong> ${lead.email} | ${lead.phone}</p>
      <p style="margin: 5px 0; color: #666;"><strong>Inquiry:</strong> "${lead.inquiry}"</p>
      <p style="margin: 5px 0; font-size: 12px; color: #999;">${new Date(lead.timestamp).toLocaleString()}</p>
    </div>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #007AFF;">📊 Lead Report - Last ${timeFrame.label}</h2>

      <div style="display: flex; gap: 20px; margin: 20px 0;">
        <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; flex: 1; text-align: center;">
          <h3 style="margin: 0; color: #0066cc; font-size: 24px;">${recentLeads.length}</h3>
          <p style="margin: 5px 0; color: #666;">New Leads</p>
        </div>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; flex: 1; text-align: center;">
          <h3 style="margin: 0; color: #0066cc; font-size: 24px;">${totalLeads}</h3>
          <p style="margin: 5px 0; color: #666;">Total Leads</p>
        </div>
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; flex: 1; text-align: center;">
          <h3 style="margin: 0; color: #0066cc; font-size: 24px;">${conversionRate}%</h3>
          <p style="margin: 5px 0; color: #666;">Contact Rate</p>
        </div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0;">Recent Leads:</h3>
      ${leadsHTML}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.DASHBOARD_URL || 'https://staff-in-a-box-production.up.railway.app'}/dashboard"
           style="background: #007AFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Full Dashboard
        </a>
      </div>

      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
        Generated by Staff in a Box AI Receptionist<br>
        To change notification settings, visit your dashboard.
      </p>
    </div>
  `;
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

// Dashboard endpoint - simple HTML dashboard
app.get('/dashboard', (req, res) => {
  const now = new Date();
  const last24Hours = leads.filter(lead => {
    const leadTime = new Date(lead.timestamp);
    return (now - leadTime) < 24 * 60 * 60 * 1000;
  });

  const last7Days = leads.filter(lead => {
    const leadTime = new Date(lead.timestamp);
    return (now - leadTime) < 7 * 24 * 60 * 60 * 1000;
  });

  const totalContacts = leads.filter(l => l.phone !== 'Not provided' || l.email !== 'Not provided').length;
  const conversionRate = leads.length > 0 ? ((totalContacts / leads.length) * 100).toFixed(1) : 0;

  const dashboardHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Staff in a Box - Lead Dashboard</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
            .stat-number { font-size: 2.5em; font-weight: bold; color: #007AFF; margin: 0; }
            .stat-label { color: #666; margin: 5px 0; }
            .leads-section { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .lead-item { border-left: 4px solid #007AFF; padding: 15px; margin: 10px 0; background: #f8f9fa; }
            .settings { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .form-group { margin: 15px 0; }
            label { display: block; margin-bottom: 5px; font-weight: 500; }
            input, select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 200px; }
            button { background: #007AFF; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 Lead Dashboard</h1>
                <p>AI Receptionist Performance Overview</p>
            </div>

            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${leads.length}</div>
                    <div class="stat-label">Total Leads</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${last24Hours.length}</div>
                    <div class="stat-label">Last 24 Hours</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${last7Days.length}</div>
                    <div class="stat-label">Last 7 Days</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${conversionRate}%</div>
                    <div class="stat-label">Contact Rate</div>
                </div>
            </div>

            <div class="leads-section">
                <h2>Recent Leads (Last 24 Hours)</h2>
                ${last24Hours.length === 0 ? '<p style="color: #666;">No leads in the last 24 hours.</p>' :
                  last24Hours.slice(0, 10).map(lead => `
                    <div class="lead-item">
                        <h4 style="margin: 0 0 10px 0;">${lead.name}</h4>
                        <p style="margin: 5px 0;"><strong>Contact:</strong> ${lead.email} | ${lead.phone}</p>
                        <p style="margin: 5px 0;"><strong>Inquiry:</strong> "${lead.inquiry}"</p>
                        <p style="margin: 5px 0; font-size: 12px; color: #666;">${new Date(lead.timestamp).toLocaleString()}</p>
                    </div>
                  `).join('')}
            </div>

            <div class="settings">
                <h2>📧 Email Notification Settings</h2>
                <form id="settingsForm">
                    <div class="form-group">
                        <label>Email Notifications:</label>
                        <select id="enabled">
                            <option value="true" ${notificationSettings.enabled ? 'selected' : ''}>Enabled</option>
                            <option value="false" ${!notificationSettings.enabled ? 'selected' : ''}>Disabled</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Notification Frequency:</label>
                        <select id="frequency">
                            <option value="hourly" ${notificationSettings.frequency === 'hourly' ? 'selected' : ''}>Every Hour</option>
                            <option value="twice-daily" ${notificationSettings.frequency === 'twice-daily' ? 'selected' : ''}>Twice Daily (12h)</option>
                            <option value="daily" ${notificationSettings.frequency === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${notificationSettings.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Owner Email:</label>
                        <input type="email" id="ownerEmail" value="${notificationSettings.ownerEmail}">
                    </div>
                    <button type="submit">Save Settings</button>
                </form>
                <div id="status"></div>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                    Last email sent: ${notificationSettings.lastSent.toLocaleString()}<br>
                    Email service: ${emailTransporter ? 'Configured ✅' : 'Not configured ❌'}
                </p>
            </div>
        </div>

        <script>
            document.getElementById('settingsForm').addEventListener('submit', async (e) => {
                e.preventDefault();

                const settings = {
                    enabled: document.getElementById('enabled').value === 'true',
                    frequency: document.getElementById('frequency').value,
                    ownerEmail: document.getElementById('ownerEmail').value
                };

                try {
                    const response = await fetch('/api/settings/notifications', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(settings)
                    });

                    const result = await response.json();

                    if (response.ok) {
                        document.getElementById('status').innerHTML = '<div class="success">Settings saved successfully!</div>';
                    } else {
                        document.getElementById('status').innerHTML = '<div class="error">Error: ' + result.error + '</div>';
                    }
                } catch (error) {
                    document.getElementById('status').innerHTML = '<div class="error">Error saving settings</div>';
                }
            });
        </script>
    </body>
    </html>
  `;

  res.send(dashboardHTML);
});

// API endpoint to update notification settings
app.post('/api/settings/notifications', (req, res) => {
  try {
    const { enabled, frequency, ownerEmail } = req.body;

    if (typeof enabled !== 'boolean' || !frequency || !ownerEmail) {
      return res.status(400).json({ error: 'Invalid settings data' });
    }

    const validFrequencies = ['hourly', 'twice-daily', 'daily', 'weekly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }

    notificationSettings.enabled = enabled;
    notificationSettings.frequency = frequency;
    notificationSettings.ownerEmail = ownerEmail;

    console.log('📧 Notification settings updated:', notificationSettings);

    res.json({
      success: true,
      settings: notificationSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// API endpoint to get leads (for potential API integration)
app.get('/api/leads', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const recent = leads.slice(-limit).reverse(); // Most recent first

  res.json({
    total: leads.length,
    leads: recent,
    settings: {
      notificationsEnabled: notificationSettings.enabled,
      frequency: notificationSettings.frequency,
      lastSent: notificationSettings.lastSent
    }
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

    // Use AI for intelligent responses - primary conversation handler
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Build conversation history for context
      const recentMessages = session.messages.slice(-6); // Last 6 messages for context
      const conversationContext = recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');

      let prompt = `You are a professional virtual receptionist for a web development company.

CRITICAL RULES:
- NEVER make up phone numbers, emails, or any contact information
- NEVER claim you will call someone unless they've provided a phone number
- Be conversational and helpful, not robotic
- Progress the conversation naturally toward understanding their needs
- If someone asks non-business questions (what time is it, are you human, etc), politely redirect to web development

CONVERSATION CONTEXT:
${conversationContext}

SESSION INFO:
- Has made business inquiry: ${session.hasMadeBusinessInquiry}
- Lead collected: ${session.leadCollected}
- Known info: Name="${session.leadInfo.name || 'none'}", Email="${session.leadInfo.email || 'none'}", Phone="${session.leadInfo.phone || 'none'}"

PRICING REFERENCE:
- Simple sites: $1,500-$3,000
- Business sites: $3,000-$8,000
- E-commerce: $8,000-$15,000+

CURRENT MESSAGE: "${message}"

Instructions:
- If they mention website needs (simple site, business, etc), acknowledge and ask follow-up questions
- If they ask about pricing, provide ranges and ask about their specific needs
- If they seem ready to move forward, ask for contact information
- Keep responses natural and conversational, not repetitive
- Don't ask for information you already have`;

      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();

      // Update session state based on AI conversation
      if (isBusinessInquiry(message) && !session.hasMadeBusinessInquiry) {
        session.hasMadeBusinessInquiry = true;
        session.leadInfo.inquiry = message;
      }

      return res.json({
        response: {
          message: aiResponse,
          agentType: 'receptionist'
        }
      });

    } catch (aiError) {
      console.error('AI Error:', aiError);
      // Fall back to smart fallback only if AI fails
    }

    // Intelligent fallback only for AI failures
    let response = getIntelligentFallback(message, session);

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
  const businessKeywords = [
    'website', 'site', 'web', 'page', 'homepage', 'landing',
    'price', 'cost', 'quote', 'pricing', 'how much', 'budget',
    'project', 'development', 'design', 'build', 'create', 'make',
    'ecommerce', 'e-commerce', 'store', 'shop', 'business',
    'simple', 'basic', 'complex', 'custom', 'professional',
    'need', 'want', 'looking for', 'require', 'help with'
  ];
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

function getIntelligentFallback(message, session) {
  const lowerMessage = message.toLowerCase();

  // Handle greetings after initial greeting
  if (session.hasGreeted && isGreeting(message)) {
    return "What can I help you with for your website project?";
  }

  // Handle specific business types intelligently FIRST
  if (lowerMessage === 'salon' || lowerMessage.includes('salon')) {
    session.hasMadeBusinessInquiry = true;
    session.leadInfo.inquiry = message;
    return "Great! A salon website is a perfect way to showcase your services and allow online booking. What specific features are you looking for - online appointments, service galleries, or something else?";
  }

  // Handle name detection specially (but not if it's a business type)
  const businessTypes = ['salon', 'restaurant', 'store', 'shop', 'business', 'website'];
  const isBusinessType = businessTypes.some(type => lowerMessage.includes(type));

  if (!isBusinessType) {
    const leadData = extractLeadInfo(message);
    if (leadData.hasContact && leadData.name) {
      session.leadInfo = { ...session.leadInfo, ...leadData };
      return `Hi ${leadData.name}! Nice to meet you. What type of website project can I help you with?`;
    }
  }

  if (lowerMessage === 'restaurant' || lowerMessage.includes('restaurant')) {
    session.hasMadeBusinessInquiry = true;
    session.leadInfo.inquiry = message;
    return "Excellent! Restaurant websites are great for showcasing your menu and taking online orders. Are you looking for online ordering, reservations, or just an informational site?";
  }

  if (lowerMessage === 'business' || lowerMessage.includes('business website')) {
    session.hasMadeBusinessInquiry = true;
    session.leadInfo.inquiry = message;
    return "Perfect! Business websites help establish credibility and attract customers. What type of business is this for, and what key information do you want to showcase?";
  }

  // Detect bot testing/spam behavior
  const spamIndicators = ['you are human', 'are you a bot', 'what time is it', 'i like you', 'what you do', 'what is your name'];
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

  // Handle business inquiries more intelligently
  if (isBusinessInquiry(message)) {
    session.hasMadeBusinessInquiry = true;
    session.leadInfo.inquiry = message;

    if (lowerMessage.includes('simple') || lowerMessage.includes('basic')) {
      return "A simple website is a great choice! These typically include a homepage, about page, services, and contact info. Pricing starts around $1,500. What's your business about?";
    }

    if (lowerMessage.includes('ecommerce') || lowerMessage.includes('store') || lowerMessage.includes('shop')) {
      return "An online store is excellent for growing your business! E-commerce sites start around $8,000 and include product pages, shopping cart, and payment processing. What will you be selling?";
    }

    if (lowerMessage.includes('need') || lowerMessage.includes('want') || lowerMessage.includes('looking for')) {
      return "I'd love to help you get the website you need! What type of business or project is this for? That'll help me give you the best recommendations.";
    }
  }

  // Standard fallback responses
  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
    return "Our websites range from $1,500 for simple sites to $15,000+ for e-commerce. What type of project do you have in mind?";
  }

  if (lowerMessage.includes('urgent')) {
    return "I understand this is urgent! What type of website assistance do you need?";
  }

  // Final fallback - but make it less generic
  return "I'm here to help with your website project! What type of website are you thinking about?";
}

// Setup cron jobs for periodic email reports
function setupCronJobs() {
  // Every hour check for hourly reports
  cron.schedule('0 * * * *', () => {
    if (notificationSettings.enabled && notificationSettings.frequency === 'hourly') {
      console.log('⏰ Running hourly email report...');
      sendPeriodicReport();
    }
  });

  // Twice daily at 9 AM and 9 PM
  cron.schedule('0 9,21 * * *', () => {
    if (notificationSettings.enabled && notificationSettings.frequency === 'twice-daily') {
      console.log('⏰ Running twice-daily email report...');
      sendPeriodicReport();
    }
  });

  // Daily at 9 AM
  cron.schedule('0 9 * * *', () => {
    if (notificationSettings.enabled && notificationSettings.frequency === 'daily') {
      console.log('⏰ Running daily email report...');
      sendPeriodicReport();
    }
  });

  // Weekly on Mondays at 9 AM
  cron.schedule('0 9 * * 1', () => {
    if (notificationSettings.enabled && notificationSettings.frequency === 'weekly') {
      console.log('⏰ Running weekly email report...');
      sendPeriodicReport();
    }
  });

  console.log('📅 Cron jobs scheduled for email notifications');
}

// Setup cron jobs when server starts
setupCronJobs();

// Debug environment
console.log('Starting server...');
console.log('Environment variables:');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Set ✓' : 'Not set ✗');
console.log('- GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? 'Set ✓' : 'Not set ✗');
console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set ✓' : 'Not set ✗');
console.log('- GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? 'Set ✓' : 'Not set ✗');
console.log('- EMAIL_SERVICE:', process.env.EMAIL_SERVICE ? 'Set ✓' : 'Not set ✗');
console.log('- EMAIL_USER:', process.env.EMAIL_USER ? 'Set ✓' : 'Not set ✗');
console.log('- EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set ✓' : 'Not set ✗');
console.log('- OWNER_EMAIL:', process.env.OWNER_EMAIL ? 'Set ✓' : 'Not set ✗');

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