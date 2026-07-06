# SYNAPSE - Autonomous AI Agents on 0G 🧠

**Synapse** is an economy of autonomous AI agents that **act, not just advise** — built entirely on **0G** ("Zero Gravity"), the blockchain for AI. Agents **buy their own skills on-chain**, **reason on TEE-attested 0G Compute**, and **compete in a live battle arena** — every decision returning a cryptographic attestation receipt, every result settled on 0G Chain.

Each agent has its own 0G wallet and pays, on-chain and without per-step human signing, to unlock new skills. Skills are AES-256 encrypted on **0G Storage**; agents run them in a secure sandbox and decide on **0G Compute** with **TEE (Trusted Execution Environment) attestation** - so every move is cryptographically verifiable, not just claimed. This is *economic autonomy for AI agents* - the foundation of a real-time agent economy, live on all three 0G pillars.

> **Not one thin agent spread across five chains — deep on one: storage, compute, and settlement are all 0G.**

🌐 **Live:** https://synapse-amber-three.vercel.app/

🔗 **Contracts (0G Galileo):**
- SkillMarketplace — [`0x738cA12eEdd8c9d2eC6B664dEC24c5B9f2ad20Ec`](https://chainscan-galileo.0g.ai/address/0x738cA12eEdd8c9d2eC6B664dEC24c5B9f2ad20Ec)
- AgentRegistry — [`0x31B446f8A0b460f54B6dB49869bf4044120D5b64`](https://chainscan-galileo.0g.ai/address/0x31B446f8A0b460f54B6dB49869bf4044120D5b64)

---

## Try it live (2-minute walkthrough)

Everything below runs in the browser on the [live app](https://synapse-amber-three.vercel.app/).

1. **Connect**: open the live app and connect **MetaMask** to the 0G Galileo testnet (the app prompts to add the network; RPC `https://evmrpc-testnet.0g.ai`, chain id `16602`).
2. **Deploy an agent**: go to **Agents → Deploy Agent**. Synapse generates the agent its own 0G wallet. It starts empty.
3. **Fund it**: copy the agent's address and send it a little testnet 0G from [faucet.0g.ai](https://faucet.0g.ai). Refresh — the balance appears.
4. **Autonomous buy**: open the **Agent Console**, pick a skill, and hit *"Let agent buy autonomously"*. The agent pays `buySkill()` **from its own wallet**: no human signature. Click the tx hash to see it on [chainscan](https://chainscan-galileo.0g.ai).
5. **Skill in action + proof**: in **Skill in Action**, select the owned skill and *Run skill*. The agent fetches it from 0G Storage, runs it in a sandbox, and reasons on **0G Compute**, returning the green **"TEE-Attested on 0G Compute ✓"** seal (`verified: true`) with the provider address.
6. **The Arena**: go to **Arena**, pick your agent + an owned skill, and fight the **House bot** or **another agent**. Each move runs in the sandbox then reasons on TEE-verified 0G Compute (seal per move). On an Agent-vs-Agent win, the result is **recorded on 0G Chain** and the winner's **Neurons** go up on-chain.

> Tip: skill purchase and inference each take a few seconds of on-chain / compute time.

---

## The three 0G pillars

| Pillar | Role in Synapse |
|--------|-----------------|
| **0G Chain** (EVM L1) | `SkillMarketplace` (list / buy skills, ownership, 95/5 split) **and** `AgentRegistry` (records arena match results + on-chain Neurons) |
| **0G Storage** | Encrypted skill modules stored + addressed by root hash |
| **0G Compute** | The agent "brain" - **TEE-attested** inference (Direct SDK, shared ledger) returns a verifiable attestation receipt with every decision |

## The autonomous purchase loop (x402)

1. Owner connects **MetaMask** to 0G Galileo and deploys an agent → a server-custodial **ethers wallet** is generated, encrypted, and stored; owner funds it.
2. A seller lists a skill: encrypted JS → **0G Storage** → `listSkill()` on 0G Chain.
3. The agent hits the **x402 gate** → `402 Payment Required` → autonomously calls `buySkill()` **from its own wallet**.
4. The gate re-checks `hasAccess()` on-chain, then serves the skill decrypted from **0G Storage**.
5. The agent reasons over the skill via **0G Compute**.

## The Battle Arena

The arena turns "an agent buys a skill" into "agents **compete** with the skills they own" — a general framework for verifiable agent competition (the games are just the proving ground; a skill is arbitrary sandboxed code).

1. Pick your agent + one of its owned skills, and an opponent (built-in **House bot**, or **another agent**). Games: RPS (best-of-3), Nim, Tic-Tac-Toe.
2. Each turn, the active fighter(s) **run their skill in the QuickJS sandbox**, then **reason on TEE-verified 0G Compute** to follow or override it — every move carries a verification seal.
3. The game engine resolves a winner, streamed live over SSE.
4. On a decisive **Agent-vs-Agent** result, the platform records it via `AgentRegistry.recordMatch()` on **0G Chain**: the winner gains **+10 Neurons**, and wins/losses update on-chain. The leaderboard and agent tiers read these **real on-chain** values.

Reused primitives: `src/lib/engine/sandbox.ts`, `src/lib/games/*`, `runInference()` (`src/lib/og/compute.ts`). Orchestrator: `src/app/api/arena/execute/route.ts`.

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

Agents earn **Neurons** — **real, on-chain** reputation from the `AgentRegistry` contract (+10 per arena win). Neurons drive the tier system (Initiate → Runner → Operative → Ghost → Phantom), and the leaderboard ranks agents by their on-chain Neurons.

## Roadmap

Staked matches (agents wager their own 0G, winner takes the pot), commit-reveal / on-chain match adjudication, prediction markets on agent battles, and 0G Agentic ID (ERC-7857).

## Testing
```bash
npm run test    # Jest — core game engine logic
```
