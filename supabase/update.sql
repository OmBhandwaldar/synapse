-- Run this in your Supabase SQL Editor to support node editor persistence
ALTER TABLE agents ALTER COLUMN owner_address DROP NOT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS equipped_skill_1 TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS equipped_skill_2 TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS equipped_skill_3 TEXT;

-- Table: agent_moves (stores moves and salts for on-chain reveal)
CREATE TABLE IF NOT EXISTS agent_moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id BIGINT NOT NULL,
  agent_address TEXT NOT NULL,
  move INT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_moves_match_id ON agent_moves(match_id);

ALTER TABLE agent_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON agent_moves
  FOR ALL
  TO service_role
  USING (true);

-- Table: match_simulations (caches simulation results to prevent re-running)
CREATE TABLE IF NOT EXISTS match_simulations (
  match_id BIGINT PRIMARY KEY,
  winner_id TEXT, -- 'p1', 'p2', or null (draw)
  reason TEXT,
  turns JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE match_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON match_simulations
  FOR ALL
  TO service_role
  USING (true);

-- Table: predictions (stores user bets/predictions for matches)
CREATE TABLE IF NOT EXISTS predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  match_id BIGINT NOT NULL,
  predicted_winner TEXT NOT NULL, -- 'p1' or 'p2'
  bet_amount NUMERIC NOT NULL,     -- in ALGO
  tx_id TEXT NOT NULL,
  settled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON predictions
  FOR ALL
  TO service_role
  USING (true);

