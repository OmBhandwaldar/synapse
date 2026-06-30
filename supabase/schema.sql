-- =============================================================================
-- Supabase Schema for Synapse Agent Key Vault (0G)
-- Run this in your Supabase project's SQL Editor
-- =============================================================================

-- Table: agents (private key vault — public data lives on 0G Chain)
CREATE TABLE IF NOT EXISTS agents (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_address        TEXT NOT NULL,                -- Owner's 0G (EVM) wallet
  agent_address        TEXT NOT NULL UNIQUE,         -- Agent's 0G (EVM) wallet (public)
  encrypted_secret_key TEXT NOT NULL,                -- AES-256-GCM encrypted private key
  agent_name           TEXT NOT NULL,
  equipped_skill_1     TEXT,                         -- on-chain skill id the agent has equipped
  equipped_skill_2     TEXT,
  equipped_skill_3     TEXT,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If the table already existed without the skill columns, add them:
ALTER TABLE agents ADD COLUMN IF NOT EXISTS equipped_skill_1 TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS equipped_skill_2 TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS equipped_skill_3 TEXT;

-- Index for fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_address);

-- Row Level Security (keep this table private — only the backend reads via the service key)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Only allow service_role (your backend) to access this table.
-- NO public anon access — this is a vault holding encrypted private keys.
DROP POLICY IF EXISTS "Service role only" ON agents;
CREATE POLICY "Service role only" ON agents
  FOR ALL
  TO service_role
  USING (true);

-- =============================================================================
-- Done. No other tables needed — everything public lives on 0G Chain / 0G Storage.
-- =============================================================================
