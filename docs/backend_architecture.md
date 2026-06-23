# CORTEX — Backend Architecture Map

This document outlines the server-side operations, API routes, third-party integrations, and database relations of the CORTEX platform.

---

## 1. Directory Structure of the Backend

All backend APIs are implemented as Next.js API Routes (using the App Router structure) under `src/app/api/`.

```
src/
  app/
    api/
      agent/
        deploy/           # Agent wallet generation & storage
        list/             # Lists owned agents + fetches Algorand balances
      skills/
        [id]/
          access/         # Gated file endpoint (returns 402 if unpurchased)
          content/        # Decrypts & serves purchased skill code from IPFS
        buy/              # Pre-builds buy transactions for wallet sign
        list/             # Pre-builds list transactions for wallet sign
        list-all/         # Queries marketplace boxes from Algorand
        owned/            # Fetches skills owned by an address
        submit/           # Broadcasts signed transactions to Testnet
        upload/           # Encrypts & pins skill code to Pinata IPFS
      match/
        create/           # Match commit (generates salt, caches move)
        join/             # Match commit (generates salt, caches move)
        list/             # Fetches match boxes from Algorand
        settle/           # Match reveal (retrieves moves/salts, builds settle call + pays out predictions)
        simulation/       # Feeds SSE stream of past battle logs
      arena/
        execute/          # Battle loop (QuickJS WASM sandbox + Gemini LLM)
      predictions/
        bet/              # Builds prediction payment txn to server-managed escrow
        submit/           # Broadcasts txn & saves prediction in database
        list/             # Fetches active matches and calculates pools & odds
      leaderboard/        # Aggregates agent Box statistics from registry contract
  lib/
    AgentRegistryClient.ts# Transaction builder for registry and matches
    SkillMarketplaceClient.ts # Transaction builder for marketplace
    encryption.ts         # AES-256-GCM encryption utilities
    ipfs.ts               # Pinata API interface
    engine/
      sandbox.ts          # quickjs-emscripten evaluation sandbox
    games/
      rps.ts              # Rock-Paper-Scissors rules and validator
      tictactoe.ts        # Tic-Tac-Toe rules and validator
      nim.ts              # Nim subtraction rules and validator
```

---

## 2. API Endpoint Workflows & Data Connections

### A. Agent Deployment (`POST /api/agent/deploy`)
* **Input**: `{ ownerAddress, agentName }`
* **Workflow**:
  1. Generates a fresh Algorand account via `algosdk.generateAccount()`.
  2. Encrypts the agent's private key (`sk`) using AES-256-GCM with the server-side `AGENT_ENCRYPTION_KEY`.
  3. Inserts `{ owner_address, agent_address, encrypted_secret_key, agent_name }` into the Supabase `agents` table.
  4. Returns the public `agentAddress`.
* **Connections**: Supabase (`agents` table).

### B. Agent Listing (`GET /api/agent/list`)
* **Query**: `?owner=OWNER_ADDRESS`
* **Workflow**:
  1. Queries the Supabase `agents` table for rows matching `owner_address`.
  2. For each agent, calls the Algorand node (`algod`) to query the account balance.
  3. Enriches the database records with live ALGO balances and return them.
* **Connections**: Supabase, Algorand Testnet node.

### C. Skill Upload & Listing (`POST /api/skills/upload`, `POST /api/skills/list`)
* **Upload**:
  1. Receives raw JS source code.
  2. Encrypts the code with `SKILL_ENCRYPTION_KEY` using AES-256-GCM.
  3. Uploads the encrypted code to IPFS using the Pinata SDK.
  4. Returns the IPFS CID (`ipcsCid`).
* **Listing**:
  1. Receives listing details and builds an atomic group of transactions:
     * `mbrPayment`: Payment of `195,000` microALGO to the marketplace contract (covers Minimum Balance Requirement for the on-chain box).
     * `appCall`: Application call calling `listSkill(name, desc, type, version, price, cid)`.
  2. Returns the unsigned transactions encoded in base64.
* **Connections**: Pinata IPFS API, Algorand node.

### D. x402 Content Gate (`GET /api/skills/[id]/content`)
* **Input**: `skillId`, `buyerAddress` (representing the player or agent)
* **Workflow**:
  1. Checks if the buyer has purchased the skill by checking for the purchase box `itob(skillId) + "_" + rawBytes(buyerAddress)` on the `SkillMarketplace` contract.
  2. If the box does not exist, returns `402 Payment Required`.
  3. If the box exists, fetches the encrypted skill content from Pinata IPFS.
  4. Decrypts the code with `SKILL_ENCRYPTION_KEY` and returns the plaintext JavaScript.
* **Connections**: Algorand Testnet node, Pinata IPFS.

### E. Match Commit-Reveal (`POST /api/match/create`, `POST /api/match/join`, `POST /api/match/settle`)
* **Create/Join**:
  1. Generates a random 32-byte salt.
  2. Computes the hash: `sha256(itob(move) + salt)`.
  3. Saves the plaintext move and base64-encoded salt in Supabase `agent_moves` table.
  4. Builds the transaction calling `createMatch` or `joinMatch` with the hash.
* **Settle**:
  1. Fetches the on-chain match record to get participant addresses.
  2. Queries the Supabase `agent_moves` table for the committed moves and salts of both agents.
  3. Builds the transaction calling `settleMatch(matchId, moveA, saltA, moveB, saltB)` on the contract.
  4. Resolves payouts, updates wins/losses and Neurons on-chain.
* **Connections**: Supabase (`agent_moves` table), Algorand Testnet node.

### F. Battle Simulation Engine (`POST /api/arena/execute`)
* **Input**: `{ gameId, agent1Address, agent2Address, matchId }`
* **Workflow**:
  1. **Lock Check**: If `matchId` is provided, queries the Supabase `match_simulations` table. If a simulation is already cached, it streams it to the client via Server-Sent Events (SSE) and terminates (prevents double running).
  2. **Code Resolution**: Queries the Supabase `agents` table to find equipped skills. Resolves the code (either custom equipped skills decrypted via the x402 gate or the default logic script).
  3. **WASM Evaluation**: Evaluates the resolved code for both agents inside the isolated `quickjs-emscripten` sandbox, injecting game state and turn logs.
  4. **Gemini Parallel Override**: Passes the sandbox suggestions, history, and state to Gemini 2.5 Flash in parallel. If Gemini outputs an override, it replaces the sandbox move and records the reasoning.
  5. **Resolution**: Evaluates the moves using the game engine rules, increments rounds, and checks for winners.
  6. **Caching**: If a `matchId` is provided, saves the final log array to `match_simulations`.
  7. **SSE Streaming**: Streams each turn's outputs and final winner payload back to the browser in real-time.
* **Connections**: Supabase (`agents`, `match_simulations` tables), Gemini 2.5 Flash API, QuickJS WASM runtime.

### G. Predictions Market (`POST /api/predictions/bet`, `POST /api/predictions/submit`, `GET /api/predictions/list`)
* **Bet/Build**: Generates a payment transaction of \`betAmount\` ALGO from the user address to the \`PREDICTION_ESCROW_ADDRESS\` (server-managed escrow account).
* **Submit**: Broadcasts the signed payment transaction to the blockchain, confirms it, and inserts a row in the Supabase \`predictions\` table (\`settled: false\`).
* **List**: Reads all open matches from the contract, fetches all active bets from the database, and calculates the total pools, pool percentages, and dynamic odds for both participants (\`odds = totalPool / sidePool\`).
* **Connections**: Supabase (\`predictions\` table), Algorand Testnet node, \`EscrowManager\`.

### H. ELO Leaderboard (`GET /api/leaderboard`)
* **Workflow**:
  1. Queries the Algorand Node to retrieve the \`ac\` (agent count) global state from the \`AgentRegistry\` app.
  2. Reads all agent boxes (\`agt_\` + agentPubKey) from the contract.
  3. Parses each box's \`AgentRecord\` to extract name, ELO (neuronsLevel), wins, losses, and created timestamp.
  4. Returns the list sorted descending by ELO/Neurons.
* **Connections**: Algorand Testnet node.

---

## 3. Database Schema Mapping

```
 Supabase PostgreSQL Database
 ┌─────────────────────────────────────────────────────────┐
 │ agents                                                  │
 ├─────────────────────────────────────────────────────────┤
 │ id (UUID) | owner_address (TEXT) | agent_name (TEXT)     │
 │ agent_address (TEXT, UNIQUE)                            │
 │ encrypted_secret_key (TEXT)                             │
 │ equipped_skill_1, equipped_skill_2, equipped_skill_3    │
 └───────────────────────────┬─────────────────────────────┘
                             │
                             ▼
 ┌─────────────────────────────────────────────────────────┐
 │ agent_moves                                             │
 ├─────────────────────────────────────────────────────────┤
 │ id (UUID) | match_id (BIGINT)                           │
 │ agent_address (TEXT)                                    │
 │ move (INT) | salt (TEXT, Base64)                        │
 └─────────────────────────────────────────────────────────┘
 
 ┌─────────────────────────────────────────────────────────┐
 │ match_simulations                                       │
 ├─────────────────────────────────────────────────────────┤
 │ match_id (BIGINT, PK)                                   │
 │ winner_id (TEXT, 'p1'/'p2'/null)                        │
 │ reason (TEXT) | turns (JSONB)                           │
 └─────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────┐
 │ predictions                                             │
 ├─────────────────────────────────────────────────────────┤
 │ id (UUID) | user_address (TEXT) | match_id (BIGINT)     │
 │ predicted_winner (TEXT, 'p1'/'p2')                      │
 │ bet_amount (NUMERIC) | tx_id (TEXT)                     │
 │ settled (BOOLEAN) | created_at (TIMESTAMP)              │
  └─────────────────────────────────────────────────────────┘
```
