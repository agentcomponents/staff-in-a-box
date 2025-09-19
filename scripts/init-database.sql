-- Staff in a Box Database Schema
-- Supabase PostgreSQL initialization script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Business configuration table
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  industry TEXT DEFAULT 'web_design',
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  website TEXT,
  business_hours JSONB DEFAULT '{"mon": "9-17", "tue": "9-17", "wed": "9-17", "thu": "9-17", "fri": "9-17", "sat": "closed", "sun": "closed"}',
  services JSONB DEFAULT '[]',
  pricing_tiers JSONB DEFAULT '{}',
  faq_data JSONB DEFAULT '[]',
  brand_voice TEXT DEFAULT 'professional_friendly',
  escalation_rules JSONB DEFAULT '{"immediate": ["existing_site_modifications", "angry_customer"], "schedule_call": ["complex_requirements", "budget_over_15k"]}',
  enabled_agents JSONB DEFAULT '["receptionist", "coordinator"]',
  agent_configs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  inquiry_type TEXT, -- 'pricing', 'services', 'escalation', 'general'
  project_type TEXT, -- 'website', 'ecommerce', 'redesign', 'one_page'
  budget_range TEXT, -- 'under_5k', '5k-15k', '15k+', 'not_specified'
  urgency TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  status TEXT DEFAULT 'active', -- 'active', 'closed', 'escalated', 'callback_scheduled'
  assigned_agent TEXT DEFAULT 'receptionist',
  lead_quality TEXT, -- 'hot', 'warm', 'cold', 'unqualified'
  contact_collection_stage TEXT, -- 'collect_name', 'collect_phone', 'collect_email', 'complete'
  has_contact_info BOOLEAN DEFAULT FALSE,
  escalation_pending BOOLEAN DEFAULT FALSE,
  conversation_data JSONB DEFAULT '{}', -- Store conversation-specific metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, -- 'customer', 'agent', 'system'
  agent_type TEXT, -- 'receptionist', 'sales', 'coordinator', 'business_manager'
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'system_action', 'escalation'
  metadata JSONB DEFAULT '{}', -- Store additional message metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent configurations per business
CREATE TABLE agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL, -- 'receptionist', 'sales', 'business_manager', 'coordinator'
  personality_preset TEXT DEFAULT 'professional', -- 'professional', 'friendly', 'technical'
  knowledge_base JSONB DEFAULT '{}', -- Industry-specific knowledge
  capabilities JSONB DEFAULT '[]', -- What this agent can/cannot do
  decision_thresholds JSONB DEFAULT '{}', -- When to escalate, pricing limits
  voice_settings JSONB DEFAULT '{"gender": "female", "tone": "professional"}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, agent_type)
);

-- Escalations table
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  escalation_reason TEXT NOT NULL,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  urgency TEXT, -- 'immediate', 'callback', 'flexible'
  customer_info JSONB DEFAULT '{}',
  original_message TEXT,
  agent_response TEXT,
  summary TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved'
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business insights and learning
CREATE TABLE business_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- 'common_inquiry', 'pricing_feedback', 'conversion_pattern'
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL DEFAULT 0.5,
  impact_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  status TEXT DEFAULT 'active', -- 'active', 'implemented', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks and callbacks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL, -- 'callback', 'follow_up', 'quote_preparation'
  priority TEXT DEFAULT 'medium',
  scheduled_time TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  customer_info JSONB DEFAULT '{}',
  task_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  assigned_to TEXT, -- 'owner', 'agent_type'
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System logs
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL, -- 'info', 'warn', 'error', 'debug'
  event_type TEXT NOT NULL, -- 'message_processed', 'escalation_created', 'notification_sent'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_business_id ON conversations(business_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_escalations_business_id ON escalations(business_id);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_priority ON escalations(priority);
CREATE INDEX idx_tasks_business_id ON tasks(business_id);
CREATE INDEX idx_tasks_scheduled_time ON tasks(scheduled_time);
CREATE INDEX idx_tasks_status ON tasks(status);

-- RLS (Row Level Security) policies for Supabase
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (basic example - adjust based on your auth strategy)
CREATE POLICY "Users can view their own business data" ON businesses
  FOR ALL USING (auth.uid()::text = owner_email OR auth.role() = 'service_role');

CREATE POLICY "Users can view their business conversations" ON conversations
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE auth.uid()::text = owner_email OR auth.role() = 'service_role'
    )
  );

CREATE POLICY "Users can view their business messages" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN businesses b ON c.business_id = b.id
      WHERE auth.uid()::text = b.owner_email OR auth.role() = 'service_role'
    )
  );

-- Functions for automated updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_configs_updated_at BEFORE UPDATE ON agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default business configuration
CREATE OR REPLACE FUNCTION create_default_business_config(
  business_name TEXT,
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  business_id UUID;
BEGIN
  -- Insert business
  INSERT INTO businesses (name, owner_name, owner_email, owner_phone)
  VALUES (business_name, owner_name, owner_email, owner_phone)
  RETURNING id INTO business_id;

  -- Create default agent configs
  INSERT INTO agent_configs (business_id, agent_type, personality_preset, active) VALUES
  (business_id, 'receptionist', 'professional_friendly', true),
  (business_id, 'coordinator', 'analytical', true);

  RETURN business_id;
END;
$$ LANGUAGE plpgsql;

-- Sample data for web design business (your test business)
INSERT INTO businesses (
  name,
  industry,
  owner_name,
  owner_email,
  services,
  pricing_tiers
) VALUES (
  'Your Web Design Business',
  'web_design',
  'Your Name',
  'your-email@domain.com',
  '["website_design", "app_development", "maintenance", "consulting"]',
  '{
    "one_page": {"min": 1500, "max": 3500, "typical_timeline": "1-2 weeks"},
    "business_site": {"min": 3000, "max": 10000, "typical_timeline": "2-4 weeks"},
    "ecommerce": {"min": 5000, "max": 15000, "typical_timeline": "4-8 weeks"},
    "custom_app": {"min": 10000, "max": 50000, "typical_timeline": "2-6 months"}
  }'
);