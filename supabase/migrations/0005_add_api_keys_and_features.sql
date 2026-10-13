-- Migration: Add API keys management and lead features
-- Version: 0005

-- Create Groq API Keys table
CREATE TABLE IF NOT EXISTS groq_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_encrypted text NOT NULL,
  key_name text NOT NULL DEFAULT 'Default',
  is_active boolean DEFAULT true,
  last_error text,
  error_at timestamp,
  reset_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(owner_id, api_key_encrypted)
);

-- Create Apify API Keys table
CREATE TABLE IF NOT EXISTS apify_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_encrypted text NOT NULL,
  key_name text NOT NULL DEFAULT 'Default',
  is_active boolean DEFAULT true,
  usage_count int DEFAULT 0,
  monthly_limit int DEFAULT 10,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(owner_id, api_key_encrypted)
);

-- Add columns to conversations/leads table for new features
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS lead_type text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS is_ai_mode boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS lead_bio text,
ADD COLUMN IF NOT EXISTS lead_post_captions text[],
ADD COLUMN IF NOT EXISTS full_history_loaded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS message_count_cached int DEFAULT 0;

-- Add columns to messages for mode tracking
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_ai_response boolean,
ADD COLUMN IF NOT EXISTS groq_key_used uuid REFERENCES groq_api_keys(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_groq_api_keys_owner ON groq_api_keys(owner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_apify_api_keys_owner ON apify_api_keys(owner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_ai_mode ON conversations(owner_id, is_ai_mode);

-- Enable RLS
ALTER TABLE groq_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE apify_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS groq_keys_owner_policy ON groq_api_keys;
CREATE POLICY groq_keys_owner_policy ON groq_api_keys
  FOR ALL
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS apify_keys_owner_policy ON apify_api_keys;
CREATE POLICY apify_keys_owner_policy ON apify_api_keys
  FOR ALL
  USING (owner_id = auth.uid());
