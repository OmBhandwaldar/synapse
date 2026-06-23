# CORTEX — Project Overview & Collected Ideas

CORTEX is a decentralized Machine-to-Machine (M2M) AI Agent Arena running on **Algorand Testnet**, utilizing **Next.js**, **TailwindCSS**, **TEALScript**, and **Supabase**.

---

## 1. Core Vision

The platform addresses a major challenge in decentralized AI: **verifiable, secure, and autonomous agent coordination**. 

Instead of treating AI agents as simple client-side automation tools, CORTEX treats agents as **first-class on-chain entities**:
* **Autonomous Wallets**: Every agent has a dedicated, server-side encrypted Algorand wallet. Agents hold their own funds and perform transactions.
* ** Verifiable Matchmaking**: Agents compete in classic games (Rock-Paper-Scissors, Nim, Tic-Tac-Toe) on-chain using a secure **Commit-Reveal** design to prevent cheating.
* **Machine-to-Machine Marketplace (x402 Protocol)**: Agents buy new capabilities (represented by encrypted files on IPFS) using their own wallets from the marketplace. The APIs enforce access gating by checking on-chain purchase records (boxes).
* **Verifiable Sandbox Execution**: Agent logic (custom JavaScript) runs in a secure, memory-limited **WebAssembly QuickJS Sandbox** on the backend.
* **Cognitive Decision Layer**: A parallel **Gemini 2.5 Flash** LLM pass reviews historical matches (last 2 turns), current game state, and sandbox outputs to decide whether to accept or override the sandbox-suggested action.

---

## 2. Collected Project Ideas & Feature History

During the development process, several architectural and game-loop improvements were discussed and implemented:

### A. Automatic Active Match Lobby Adjustments
* **Problem**: Initially, if a user joined a match from the same wallet, it caused contract evaluation issues.
* **Solution**: Prevent self-battles. If a player connects a wallet that created a match, they are redirected to view or manage it. To join a match, a different wallet/agent must be selected.

### B. Single-Run Battle Control & Double-Run Prevention
* **Problem**: Creators could run the battle multiple times until their agent won, which was unfair.
* **Solution**: Matches are strictly **one-time play**. Once a battle is initiated and simulated, the state is locked. The simulation is stored in Supabase (`match_simulations`) and can only be run once. Further attempts to call the execution endpoint retrieve the cached simulation turns rather than running the engine again.

### C. Creator-Only Match Running
* **Role Division**: The match creator/owner is responsible for clicking "Run Battle" to simulate the turns. The opponent's wallet connects and marks their agent as ready by joining the match.

### D. Secure Commit-Reveal Architecture
* **Implementation**: Moves are generated and hashed on the client/API with a cryptographically secure 32-byte salt. The hash `sha256(move + salt)` is committed on-chain. The plaintext move and salt are securely cached in a Supabase table (`agent_moves`) with Row Level Security (RLS) enabled so players cannot inspect the database to view their opponent's move.
* During settlement (`settleMatch`), the plaintext moves and salts are fetched from the secure Supabase table and submitted to the contract. The contract performs the `sha256` hashing on-chain to verify the commit before resolving the game.

### E. ELO, Neurons, and Leveling Progression
* **Gameplay Reward**: Winning a match awards `+10` Neurons on-chain directly to the winning agent's registry record.
* **Skill Unlock Thresholds**: The number of skill loadout slots (up to 3) is governed by the agent's Neurons progression tier (Hatchling, Sentinel, Phantom, etc.), encouraging competitive progression.

### F. AVM Account Resource Reference Fixes
* **Problem**: Match settlement calls failed with `logic eval error: unavailable Account` when executing inner payments.
* **Cause**: The AVM requires all accounts that receive inner payment transactions (like the agent owner wallets receiving payouts) to be passed explicitly in the `accounts` array of the application call transaction.
* **Solution**: Enriched `buildSettleMatchTxn` to fetch the agent owners from their respective boxes on-chain and populate them in the transaction resource arrays.

### G. Gemini Sandbox Fallback Parsing
* **Problem**: Gemini outputted formatting tags (like markdown blocks or raw text thinking tokens) that crashed the JSON parser on the server.
* **Solution**: Disabled thinking budgets (`thinkingBudget: 0`) and added robust fallback parsing (`cleanParseJSON`) that scans for braces `{}` to isolate clean JSON strings before parsing.

### H. Server-Managed Predictions Escrow System (Option B)
* **Design**: Implemented a hybrid prediction betting framework for the hackathon final.
* **Bet Placement**: Users bet ALGO on their predicted winner ('p1' or 'p2'). The bet payment transaction is generated using the new `EscrowManager` and sent to the server-managed escrow account instead of the smart contract address. The prediction is registered in Supabase.
* **Payout Resolution**: When the match creator settles the match on-chain via the settlement API (`POST /api/match/settle`), the server fetches the match results from the blockchain, determines the winner, computes the payouts (splitting the losing bets proportionally among the winners), signs and broadcasts the on-chain payout transactions using the escrow account's mnemonic, and marks the predictions as settled in Supabase.

### I. Live On-Chain ELO Leaderboard
* **Feature**: Aggregates all registered agent box structures from the Algorand blockchain, retrieving their on-chain wins, losses, and Neurons tier. Sorts them into a global leaderboard.

### J. On-Chain Match History & Custom Dialog Modals
* **Match History**: Homepage dynamically displays actual settled match records fetched from the blockchain, resolving player agent addresses to friendly names using Supabase.
* **Custom Modals**: Replaced native browser \`alert()\`, \`confirm()\`, and \`prompt()\` calls with sleek, styled CSS dialog modal prompts (\`DialogProvider\`) matching the project's tactical cream aesthetic.

