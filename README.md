# SYNAPSE — Autonomous Agent Skill Marketplace on 0G 🧠

**Synapse** is an AI-agent skill marketplace where autonomous agents **buy their own abilities** and evolve — built entirely on **0G** ("Zero Gravity"), the blockchain for AI.

Each agent has its own server-custodial 0G wallet. It pays, on-chain and without per-step human signing, to unlock new skills (strategy, vision, combat modules). Skills are encrypted and stored on **0G Storage**; the agent's decision-making runs on **0G Compute**. This is *economic autonomy for AI agents* — the foundation of a real-time agent economy.

🌐 **Live:** https://synapse-amber-three.vercel.app/
🔗 **Contract (0G Galileo):** [`0x738cA12eEdd8c9d2eC6B664dEC24c5B9f2ad20Ec`](https://chainscan-galileo.0g.ai/address/0x738cA12eEdd8c9d2eC6B664dEC24c5B9f2ad20Ec)

---

## The three 0G pillars

| Pillar | Role in Synapse |
|--------|-----------------|
| **0G Chain** (EVM L1) | `SkillMarketplace` Solidity contract — list / buy skills, on-chain ownership records, 95/5 fee split |
| **0G Storage** | Encrypted skill modules stored + addressed by root hash |
| **0G Compute** | The agent "brain" — verifiable inference (Direct SDK, or Router) decides moves/purchases |

## The autonomous purchase loop (x402)

1. Owner connects **MetaMask** to 0G Galileo and deploys an agent → a server-custodial **ethers wallet** is generated, encrypted, and stored; owner funds it.
2. A seller lists a skill: encrypted JS → **0G Storage** → `listSkill()` on 0G Chain.
3. The agent hits the **x402 gate** → `402 Payment Required` → autonomously calls `buySkill()` **from its own wallet**.
4. The gate re-checks `hasAccess()` on-chain, then serves the skill decrypted from **0G Storage**.
5. The agent reasons over the skill via **0G Compute**.

## Tech stack

- **Next.js 16** (App Router) + **Tailwind v4** + TypeScript
- **ethers v6** on 0G Galileo testnet (chain id `16602`)
- **0G Storage** (`@0gfoundation/0g-storage-ts-sdk`) · **0G Compute** (`@0glabs/0g-serving-broker`)
- **Foundry** for contract deployment · **Supabase** for the off-chain agent vault
- AES-256-GCM skill encryption · QuickJS sandbox for skill execution

---

## Local development

### Prerequisites
- Node.js 18+
- [MetaMask](https://metamask.io/) on the 0G Galileo network (RPC `https://evmrpc-testnet.0g.ai`, chain id `16602`)
- Testnet 0G from https://faucet.0g.ai
- [Foundry](https://book.getfoundry.sh/) (only to deploy the contract)

### Setup
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

### Deploy the contract (Foundry)
See [`smart_contracts/solidity/DEPLOY.md`](smart_contracts/solidity/DEPLOY.md). In short:
```bash
forge create --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $PLATFORM_PRIVATE_KEY --evm-version cancun \
  smart_contracts/solidity/SkillMarketplace.sol:SkillMarketplace
```
Put the deployed address in `.env.local` as `NEXT_PUBLIC_SKILL_MARKETPLACE_ADDRESS`.

### Verification scripts (run against live 0G)
```bash
node scripts/seed-skill.mjs     # encrypt + upload a skill to 0G Storage, list it on-chain
node scripts/verify-loop.mjs    # fund an agent -> autonomous buy -> access flip -> storage fetch + decrypt
node scripts/router-smoke.mjs   # agent "brain" inference via 0G Compute (router mode)
```

---

## Progression

Agents earn **Neurons** (XP) and climb tiers (Hatchling → Runner → Operative → Ghost → Phantom), unlocking more agent and skill slots.

## Roadmap (post Group Stage)

Battle arena + live cognitive override, commit-reveal matches, on-chain agent registry + Neurons, prediction markets, and 0G Agentic ID (ERC-7857).

## Testing
```bash
npm run test    # Jest — core game engine logic
```
