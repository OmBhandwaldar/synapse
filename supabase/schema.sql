-- =============================================================================
-- Supabase Schema for Synapse Agent Key Vault
-- Run this in your Supabase project's SQL Editor
-- =============================================================================

-- Table: agents (private key vault only — public data lives on Algorand)
CREATE TABLE IF NOT EXISTS agents (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_address        TEXT NOT NULL,                -- Human's Algorand wallet
  agent_address        TEXT NOT NULL UNIQUE,         -- Agent's Algorand wallet (public)
  encrypted_secret_key TEXT NOT NULL,               -- AES-256-GCM encrypted private key
  agent_name           TEXT NOT NULL,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_address);

-- Row Level Security (keep this table private — only backend reads via service key)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Only allow service_role (your backend) to access this table
-- NO public anon access — this is a vault
CREATE POLICY "Service role only" ON agents
  FOR ALL
  TO service_role
  USING (true);

-- =============================================================================
-- Done. No other tables needed — everything else is on Algorand.
-- =============================================================================
