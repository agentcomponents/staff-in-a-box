const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.channels = {
      sms: this.initializeSMS(),
      email: this.initializeEmail(),
      slack: this.initializeSlack(),
      push: this.initializePush()
    };
  }

  // Initialize notification channels
  initializeSMS() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio');
      return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return null;
  }

  initializeEmail() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const nodemailer = require('nodemailer');
      return nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
    return null;
  }

  initializeSlack() {
    if (process.env.SLACK_WEBHOOK_URL) {
      const { IncomingWebhook } = require('@slack/webhook');
      return new IncomingWebhook(process.env.SLACK_WEBHOOK_URL);
    }
    return null;
  }

  initializePush() {
    // Placeholder for push notification service
    return null;
  }

  // Main notification methods
  async sendEscalationNotification(escalationData) {
    const { priority, customer_info, escalation_reason, summary } = escalationData;

    const message = this.formatEscalationMessage(escalationData);

    // Send notifications based on priority
    if (priority === 'high') {
      await Promise.all([
        this.sendSMSAlert(message),
        this.sendSlackUrgent(message),
        this.sendEmailAlert(message)
      ]);
    } else {
      await Promise.all([
        this.sendSlackNotification(message),
        this.sendEmailAlert(message)
      ]);
    }
  }

  async sendImmediateEscalation(escalationData) {
    const urgentMessage = this.formatUrgentMessage(escalationData);

    // Send via all available channels for immediate escalations
    await Promise.all([
      this.sendSMSAlert(urgentMessage),
      this.sendSlackUrgent(urgentMessage),
      this.sendEmailAlert(urgentMessage),
      this.sendPushNotification(urgentMessage)
    ]);
  }

  // SMS Notifications
  async sendSMSAlert(messageData) {
    if (!this.channels.sms || !process.env.OWNER_PHONE) {
      logger.warn('SMS service not configured');
      return false;
    }

    try {
      const message = typeof messageData === 'string' ? messageData : messageData.smsText;

      await this.channels.sms.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.OWNER_PHONE
      });

      logger.info('SMS alert sent successfully');
      return true;
    } catch (error) {
      logger.error('Failed to send SMS alert:', error);
      return false;
    }
  }

  // Slack Notifications
  async sendSlackUrgent(messageData) {
    if (!this.channels.slack) {
      logger.warn('Slack service not configured');
      return false;
    }

    try {
      const slackMessage = {
        text: "🚨 URGENT ESCALATION - Staff in a Box",
        attachments: [
          {
            color: "danger",
            fields: [
              {
                title: "Customer",
                value: `${messageData.customerInfo?.name || 'Unknown'}\n📞 ${messageData.customerInfo?.phone || 'N/A'}`,
                short: true
              },
              {
                title: "Urgency",
                value: messageData.urgency || 'HIGH',
                short: true
              },
              {
                title: "Reason",
                value: messageData.escalationReason || 'Customer needs immediate assistance',
                short: false
              },
              {
                title: "Original Message",
                value: `"${messageData.originalMessage || messageData.summary}"`,
                short: false
              }
            ],
            footer: "Staff in a Box Alert System",
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      await this.channels.slack.send(slackMessage);
      logger.info('Slack urgent notification sent');
      return true;
    } catch (error) {
      logger.error('Failed to send Slack urgent notification:', error);
      return false;
    }
  }

  async sendSlackNotification(messageData) {
    if (!this.channels.slack) {
      logger.warn('Slack service not configured');
      return false;
    }

    try {
      const slackMessage = {
        text: "📋 New Escalation - Staff in a Box",
        attachments: [
          {
            color: "warning",
            fields: [
              {
                title: "Customer",
                value: `${messageData.customerInfo?.name || 'Unknown'}\n📧 ${messageData.customerInfo?.email || 'N/A'}`,
                short: true
              },
              {
                title: "Priority",
                value: messageData.priority || 'Medium',
                short: true
              },
              {
                title: "Summary",
                value: messageData.summary || 'Customer inquiry needs attention',
                short: false
              }
            ],
            footer: "Staff in a Box Alert System",
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      await this.channels.slack.send(slackMessage);
      logger.info('Slack notification sent');
      return true;
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
      return false;
    }
  }

  // Email Notifications
  async sendEmailAlert(messageData) {
    if (!this.channels.email || !process.env.OWNER_EMAIL) {
      logger.warn('Email service not configured');
      return false;
    }

    try {
      const emailContent = this.formatEmailContent(messageData);

      await this.channels.email.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.OWNER_EMAIL,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      logger.info('Email alert sent successfully');
      return true;
    } catch (error) {
      logger.error('Failed to send email alert:', error);
      return false;
    }
  }

  // Push Notifications (placeholder)
  async sendPushNotification(messageData) {
    // Implement push notification logic here
    logger.info('Push notification would be sent:', messageData);
    return true;
  }

  // Message formatting methods
  formatEscalationMessage(escalationData) {
    const { customer_info, escalation_reason, priority, summary } = escalationData;

    return {
      smsText: `🚨 Staff Alert: ${customer_info?.name || 'Customer'} needs ${priority} assistance. ${escalation_reason}. Call: ${customer_info?.phone || 'N/A'}`,

      summary: summary || 'Customer escalation needs attention',

      customerInfo: customer_info,

      escalationReason: escalation_reason,

      priority: priority
    };
  }

  formatUrgentMessage(escalationData) {
    const { customerInfo, originalMessage, urgency } = escalationData;

    return {
      smsText: `🚨 URGENT: ${customerInfo?.name} wants to speak NOW! 📞 ${customerInfo?.phone}. Issue: "${originalMessage}". Response promised in 2-5 min!`,

      customerInfo,

      originalMessage,

      urgency,

      escalationReason: 'immediate_response_requested'
    };
  }

  formatEmailContent(messageData) {
    const { customerInfo, escalationReason, priority, summary, originalMessage } = messageData;

    const subject = priority === 'high' || messageData.urgency === 'HIGH'
      ? `🚨 URGENT: Staff in a Box Escalation - ${customerInfo?.name || 'Customer'}`
      : `📋 Staff in a Box Escalation - ${customerInfo?.name || 'Customer'}`;

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: ${priority === 'high' ? '#e74c3c' : '#f39c12'};">
              ${priority === 'high' ? '🚨 URGENT ESCALATION' : '📋 New Escalation'}
            </h2>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3>Customer Information:</h3>
              <p><strong>Name:</strong> ${customerInfo?.name || 'Not provided'}</p>
              <p><strong>Phone:</strong> ${customerInfo?.phone || 'Not provided'}</p>
              <p><strong>Email:</strong> ${customerInfo?.email || 'Not provided'}</p>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3>Escalation Details:</h3>
              <p><strong>Reason:</strong> ${escalationReason || 'General inquiry'}</p>
              <p><strong>Priority:</strong> ${priority || 'Medium'}</p>
              <p><strong>Summary:</strong> ${summary || 'Customer needs assistance'}</p>
            </div>

            ${originalMessage ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>Original Message:</h3>
                <p style="font-style: italic;">"${originalMessage}"</p>
              </div>
            ` : ''}

            <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3>Suggested Response:</h3>
              <p>Hi ${customerInfo?.name || 'there'}, thanks for reaching out! I'd be happy to help with your inquiry.
              ${priority === 'high' ? 'I saw you needed immediate assistance - ' : ''}
              Are you available for a brief call to discuss your project?</p>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
              This notification was sent by Staff in a Box Alert System<br>
              Time: ${new Date().toLocaleString()}
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
      Staff in a Box ${priority === 'high' ? 'URGENT' : ''} Escalation

      Customer: ${customerInfo?.name || 'Unknown'}
      Phone: ${customerInfo?.phone || 'N/A'}
      Email: ${customerInfo?.email || 'N/A'}

      Reason: ${escalationReason || 'General inquiry'}
      Priority: ${priority || 'Medium'}

      ${originalMessage ? `Original Message: "${originalMessage}"` : ''}

      Summary: ${summary || 'Customer needs assistance'}

      Time: ${new Date().toLocaleString()}
    `;

    return { subject, html, text };
  }

  // Health check for notification services
  async checkNotificationHealth() {
    const status = {
      sms: !!this.channels.sms,
      email: !!this.channels.email,
      slack: !!this.channels.slack,
      push: !!this.channels.push
    };

    logger.info('Notification services status:', status);
    return status;
  }
}

module.exports = NotificationService;