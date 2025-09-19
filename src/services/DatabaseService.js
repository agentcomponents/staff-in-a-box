const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  // Business operations
  async getBusinessConfig(businessId) {
    try {
      const { data, error } = await this.supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting business config:', error);
      throw error;
    }
  }

  async createBusiness(businessData) {
    try {
      const { data, error } = await this.supabase
        .from('businesses')
        .insert(businessData)
        .select()
        .single();

      if (error) throw error;

      // Create default agent configs
      await this.createDefaultAgentConfigs(data.id);

      return data;
    } catch (error) {
      logger.error('Error creating business:', error);
      throw error;
    }
  }

  async updateBusiness(businessId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('businesses')
        .update(updates)
        .eq('id', businessId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating business:', error);
      throw error;
    }
  }

  // Conversation operations
  async createConversation(conversationData) {
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .insert(conversationData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error;
    }
  }

  async getConversation(conversationId) {
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      logger.error('Error getting conversation:', error);
      throw error;
    }
  }

  async updateConversation(conversationId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating conversation:', error);
      throw error;
    }
  }

  async getConversationMessages(conversationId, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  async getBusinessConversations(businessId, limit = 20, status = null) {
    try {
      let query = this.supabase
        .from('conversations')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting business conversations:', error);
      throw error;
    }
  }

  // Message operations
  async saveMessage(messageData) {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error saving message:', error);
      throw error;
    }
  }

  // Agent configuration operations
  async createDefaultAgentConfigs(businessId) {
    try {
      const defaultConfigs = [
        {
          business_id: businessId,
          agent_type: 'receptionist',
          personality_preset: 'professional_friendly',
          knowledge_base: {
            escalation_triggers: [
              'changes to my existing site',
              'modify my current',
              'update my website',
              'add to my site',
              'crypto payment',
              'payment gateway',
              'specific functionality',
              'custom feature'
            ],
            services: {
              'website_design': {
                description: 'Custom website design and development',
                typical_timeline: '2-6 weeks',
                price_range: '$2,000-$15,000'
              },
              'app_development': {
                description: 'Mobile and web application development',
                typical_timeline: '3-12 months',
                price_range: '$10,000-$100,000+'
              },
              'maintenance': {
                description: 'Ongoing website updates and support',
                typical_timeline: 'Ongoing',
                price_range: '$100-$500/month'
              }
            }
          },
          active: true
        },
        {
          business_id: businessId,
          agent_type: 'coordinator',
          personality_preset: 'analytical',
          knowledge_base: {
            routing_rules: {
              'escalation_required': ['receptionist', 'human'],
              'sales_opportunity': ['receptionist', 'sales'],
              'general_inquiry': ['receptionist']
            }
          },
          active: true
        }
      ];

      const { data, error } = await this.supabase
        .from('agent_configs')
        .insert(defaultConfigs)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating default agent configs:', error);
      throw error;
    }
  }

  async getAgentConfig(businessId, agentType) {
    try {
      const { data, error } = await this.supabase
        .from('agent_configs')
        .select('*')
        .eq('business_id', businessId)
        .eq('agent_type', agentType)
        .eq('active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      logger.error('Error getting agent config:', error);
      throw error;
    }
  }

  async updateAgentConfig(businessId, agentType, updates) {
    try {
      const { data, error } = await this.supabase
        .from('agent_configs')
        .update(updates)
        .eq('business_id', businessId)
        .eq('agent_type', agentType)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating agent config:', error);
      throw error;
    }
  }

  // Escalation operations
  async createEscalation(escalationData) {
    try {
      const { data, error } = await this.supabase
        .from('escalations')
        .insert(escalationData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating escalation:', error);
      throw error;
    }
  }

  async getEscalations(businessId, status = null, limit = 20) {
    try {
      let query = this.supabase
        .from('escalations')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting escalations:', error);
      throw error;
    }
  }

  async updateEscalation(escalationId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('escalations')
        .update(updates)
        .eq('id', escalationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating escalation:', error);
      throw error;
    }
  }

  // Task operations
  async createTask(taskData) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating task:', error);
      throw error;
    }
  }

  async getTasks(businessId, status = null, limit = 20) {
    try {
      let query = this.supabase
        .from('tasks')
        .select('*')
        .eq('business_id', businessId)
        .order('scheduled_time', { ascending: true })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting tasks:', error);
      throw error;
    }
  }

  async updateTask(taskId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating task:', error);
      throw error;
    }
  }

  // Business insights operations
  async createBusinessInsight(insightData) {
    try {
      const { data, error } = await this.supabase
        .from('business_insights')
        .insert(insightData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating business insight:', error);
      throw error;
    }
  }

  async getBusinessInsights(businessId, insightType = null, limit = 50) {
    try {
      let query = this.supabase
        .from('business_insights')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (insightType) {
        query = query.eq('insight_type', insightType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting business insights:', error);
      throw error;
    }
  }

  // System logging
  async logEvent(businessId, logLevel, eventType, message, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('system_logs')
        .insert({
          business_id: businessId,
          log_level: logLevel,
          event_type: eventType,
          message,
          metadata
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error logging event:', error);
      // Don't throw here to avoid infinite loops
    }
  }

  // Analytics and reporting
  async getConversationStats(businessId, startDate = null, endDate = null) {
    try {
      let query = this.supabase
        .from('conversations')
        .select('status, lead_quality, inquiry_type, created_at')
        .eq('business_id', businessId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process stats
      const stats = {
        total_conversations: data.length,
        by_status: {},
        by_lead_quality: {},
        by_inquiry_type: {}
      };

      data.forEach(conv => {
        // Count by status
        stats.by_status[conv.status] = (stats.by_status[conv.status] || 0) + 1;

        // Count by lead quality
        if (conv.lead_quality) {
          stats.by_lead_quality[conv.lead_quality] = (stats.by_lead_quality[conv.lead_quality] || 0) + 1;
        }

        // Count by inquiry type
        if (conv.inquiry_type) {
          stats.by_inquiry_type[conv.inquiry_type] = (stats.by_inquiry_type[conv.inquiry_type] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    try {
      const { data, error } = await this.supabase
        .from('businesses')
        .select('count(*)')
        .limit(1);

      if (error) throw error;

      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }
}

module.exports = DatabaseService;