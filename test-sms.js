// Test Twilio SMS notifications
require('dotenv').config();
const twilio = require('twilio');

async function testSMS() {
  console.log('📱 Testing Twilio SMS Notifications\n');

  // Check environment variables
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('❌ Missing Twilio credentials in .env file');
    console.log('Please add:');
    console.log('TWILIO_ACCOUNT_SID=your_account_sid');
    console.log('TWILIO_AUTH_TOKEN=your_auth_token');
    console.log('TWILIO_PHONE_NUMBER=+1234567890');
    return;
  }

  if (!process.env.OWNER_PHONE || process.env.OWNER_PHONE === '+1234567890') {
    console.log('❌ Please update OWNER_PHONE in .env to your real phone number');
    return;
  }

  try {
    // Initialize Twilio client
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    console.log('✅ Twilio client initialized');
    console.log(`📞 From: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log(`📱 To: ${process.env.OWNER_PHONE}`);

    // Send test message
    const message = await client.messages.create({
      body: '🚨 URGENT: Staff in a Box Test Alert!\n\nJohn Smith wants to speak NOW!\n📞 555-123-4567\nIssue: "I need to add a membership area to my existing site"\n\nResponse promised in 2-5 min!',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.OWNER_PHONE
    });

    console.log('\n✅ SMS sent successfully!');
    console.log(`📧 Message SID: ${message.sid}`);
    console.log(`📊 Status: ${message.status}`);

    console.log('\n🎉 Your SMS notifications are working!');
    console.log('Check your phone for the test message.');

  } catch (error) {
    console.error('❌ SMS Error:', error.message);

    if (error.code === 20003) {
      console.log('\n🔧 Authentication failed - check your Account SID and Auth Token');
    } else if (error.code === 21211) {
      console.log('\n🔧 Invalid phone number - make sure OWNER_PHONE is in format +1234567890');
    } else if (error.code === 21608) {
      console.log('\n🔧 The phone number is not verified for trial account');
      console.log('Either verify the number in Twilio Console or upgrade account');
    }
  }
}

testSMS().catch(console.error);