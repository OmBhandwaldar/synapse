// ===== NODE DATA TYPES =====

export interface WalletNodeData extends Record<string, unknown> {
  address: string;
  connected: boolean;
  label?: string;
}

export interface AgentNodeData extends Record<string, unknown> {
  name: string;
  address: string;
  owner: string;
  skills: SkillNodeData[];
  stats: {
    wins: number;
    losses: number;
    neurons: number;
  };
  status: "idle" | "deployed" | "in-match";
  code: {
    language: string;
    source: string;
  };
  label?: string;
}

export interface SkillNodeData extends Record<string, unknown> {
  cortex_skill_version: string;
  name: string;
  type: "Logic" | "Compute" | "State" | "Data" | "Prediction" | "Strategy";
  version: string;
  description: string;
  entry_point: string;
  parameters: Record<
    string,
    { type: string; required: boolean; default?: unknown }
  >;
  code: {
    language: string;
    source: string;
  };
  metadata: {
    author: string;
    tags: string[];
    min_agent_version: string;
  };
  label?: string;
}

// ===== CUSTOM NODE TYPE IDS =====

export type NodeType = "wallet" | "agent" | "skill";

// ===== CONNECTION VALIDATION =====
// Allowed connections: wallet→agent, skill→agent, agent→agent
export const VALID_CONNECTIONS: Record<string, string[]> = {
  wallet: ["agent"],
  skill: ["agent"],
  agent: ["agent"],
};
