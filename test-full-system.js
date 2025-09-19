// Test the full system with database
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ReceptionistAgent = require('./src/agents/ReceptionistAgent');
const DatabaseService = require('./src/services/DatabaseService');
const NotificationService = require('./src/services/NotificationService');

async function testFullSystem() {
  console.log('🧪 Testing Full Staff in a Box System with Database\n');

  // Initialize services
  const dbService = new DatabaseService();
  const notificationService = new NotificationService();
  const agent = new ReceptionistAgent(dbService, notificationService);

  // Get business from database
  try {
    const businessId = '362464e8-4512-4d51-ad6f-06d0db68318b';
    const businessConfig = await dbService.getBusinessConfig(businessId);
    console.log('✅ Database Connection Working');
    console.log(`📊 Business: ${businessConfig.name}`);
    console.log(`📧 Owner: ${businessConfig.owner_email}\n`);

    // Create a real conversation in the database
    const conversation = await dbService.createConversation({
      business_id: businessId,
      status: 'active',
      assigned_agent: 'receptionist'
    });

    console.log(`📝 Created conversation: ${conversation.id}\n`);

    // Test 1: Pricing inquiry
    console.log('TEST 1: Pricing Inquiry');
    console.log('Customer: "What are your hourly rates?"');

    // Save customer message
    await dbService.saveMessage({
      conversation_id: conversation.id,
      sender: 'customer',
      content: 'What are your hourly rates?'
    });

    // Get full conversation context
    const fullConversation = {
      ...conversation,
      businessConfig,
      messageCount: 1
    };

    // Override the updateConversationData method to avoid database updates
    agent.updateConversationData = async (id, data) => {
      console.log('📝 Would update conversation:', data);
      return { id, ...data };
    };

    const response1 = await agent.processMessage("What are your hourly rates?", fullConversation);
    console.log('Agent Response:', response1.message);
    console.log('Action:', response1.action);
    console.log('---\n');

    // Test 2: Escalation trigger
    console.log('TEST 2: Escalation Trigger');
    console.log('Customer: "I want to make changes to my existing site"');

    const response2 = await agent.processMessage("I want to make changes to my existing site", fullConversation);
    console.log('Agent Response:', response2.message);
    console.log('Action:', response2.action);
    console.log('Escalation Pending:', response2.escalationPending);
    console.log('---\n');

    // Test notifications if configured
    console.log('🔔 Testing Notification System...');
    const notificationHealth = await notificationService.checkNotificationHealth();
    console.log('Notification Services Status:', notificationHealth);

    if (process.env.OWNER_EMAIL) {
      console.log(`📧 Configured for: ${process.env.OWNER_EMAIL}`);
    }
    if (process.env.OWNER_PHONE) {
      console.log(`📱 SMS configured for: ${process.env.OWNER_PHONE}`);
    }

    console.log('\n✅ Full System Test Complete!');
    console.log('\n🎯 Your Staff in a Box is ready for real customers!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
  }
}

testFullSystem().catch(console.error);