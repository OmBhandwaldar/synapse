# SYNAPSE - Autonomous Agent Skill Marketplace on 0G 🧠

**Synapse** is a marketplace of autonomous AI agents that **act, not just advise** — built entirely on **0G** ("Zero Gravity"), the blockchain for AI. Agents **buy their own skills on-chain** and **reason on TEE-attested 0G Compute**, returning a verifiable attestation receipt for every decision.

Each agent has its own 0G wallet and pays, on-chain and without per-step human signing, to unlock new skills. Skills are AES-256 encrypted on **0G Storage**; agents run them in a secure sandbox and decide on **0G Compute** with **TEE (Trusted Execution Environment) attestation** - so every move is cryptographically verifiable, not just claimed. This is *economic autonomy for AI agents* - the foundation of a real-time agent economy, live on all three 0G pillars.

🌐 **Live:** https://synapse-amber-three.vercel.app/

🔗 **Contract (0G Galileo):** [`0x738cA12eEdd8c9d2eC6B664dEC24c5B9f2ad20Ec`](https://chainscan-galileo.0g.ai/address/0x738cA12eEdd8c9d2eC6B664dEC24c5B9f2ad20Ec)

---

## Try it live (2-minute walkthrough)

Everything below runs in the browser on the [live app](https://synapse-amber-three.vercel.app/).

1. **Connect**: open the live app and connect **MetaMask** to the 0G Galileo testnet (the app prompts to add the network; RPC `https://evmrpc-testnet.0g.ai`, chain id `16602`).
2. **Deploy an agent**: go to **Agents → Deploy Agent**. Synapse generates the agent its own 0G wallet. It starts empty.
3. **Fund it**: copy the agent's address and send it a little testnet 0G from [faucet.0g.ai](https://faucet.0g.ai). Refresh — the balance appears.
4. **Autonomous buy**: open the **Agent Console**, pick a skill, and hit *"Let agent buy autonomously"*. The agent pays `buySkill()` **from its own wallet**: no human signature. Click the tx hash to see it on [chainscan](https://chainscan-galileo.0g.ai).
5. **Skill in action + proof**: in **Skill in Action**, select the owned skill and *Run skill*. The agent fetches it from 0G Storage, runs it in a sandbox, and reasons on **0G Compute**, returning the green **"TEE-Attested on 0G Compute ✓"** seal (`verified: true`) with the provider address.

> Tip: skill purchase and inference each take a few seconds of on-chain / compute time.

---

## The three 0G pillars

| Pillar | Role in Synapse |
|--------|-----------------|
| **0G Chain** (EVM L1) | `SkillMarketplace` Solidity contract - list / buy skills, on-chain ownership records, 95/5 fee split |
| **0G Storage** | Encrypted skill modules stored + addressed by root hash |
| **0G Compute** | The agent "brain" - **TEE-attested** inference (Direct SDK, shared ledger) returns a verifiable attestation receipt with every decision |

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
