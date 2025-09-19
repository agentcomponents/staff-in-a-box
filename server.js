const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import core modules
const AgentOrchestrator = require('./src/core/AgentOrchestrator');
const NotificationService = require('./src/services/NotificationService');
const DatabaseService = require('./src/services/DatabaseService');
const logger = require('./src/utils/logger');

// Import routes
const conversationRoutes = require('./src/routes/conversations');
const businessRoutes = require('./src/routes/business');
const agentRoutes = require('./src/routes/agents');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"]
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
const dbService = new DatabaseService();
const notificationService = new NotificationService();
const agentOrchestrator = new AgentOrchestrator(dbService, notificationService);

// Make services available to routes
app.locals.dbService = dbService;
app.locals.agentOrchestrator = agentOrchestrator;
app.locals.notificationService = notificationService;
app.locals.io = io;

// API Routes (before static serving)
app.use('/api/conversations', conversationRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/agents', agentRoutes);

// Serve static files for local development
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join business room for real-time updates
  socket.on('join-business', (businessId) => {
    socket.join(`business-${businessId}`);
    logger.info(`Client ${socket.id} joined business room: ${businessId}`);
  });

  // Handle new messages from frontend
  socket.on('send-message', async (data) => {
    try {
      const { conversationId, message, businessId } = data;

      // Process message through agent orchestrator
      const response = await agentOrchestrator.processMessage({
        conversationId,
        message,
        businessId,
        timestamp: new Date().toISOString()
      });

      // Send response back to client
      socket.emit('agent-response', response);

      // If escalation needed, notify business owner
      if (response.action === 'escalate_to_human') {
        io.to(`business-${businessId}`).emit('escalation-alert', {
          conversationId,
          urgency: response.priority,
          customerInfo: response.customerInfo,
          summary: response.summary
        });
      }

    } catch (error) {
      logger.error('Error processing message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

console.log('Starting Staff in a Box server...');
console.log('Environment variables:');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log(`Attempting to bind to ${HOST}:${PORT}`);

server.listen(PORT, HOST, () => {
  logger.info(`✅ Staff in a Box server successfully started on ${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Server successfully started on ${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});

server.on('error', (error) => {
  logger.error('❌ Server error:', error);
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };