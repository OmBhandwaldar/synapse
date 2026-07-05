// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgentRegistry
 * @notice On-chain registry + reputation for Synapse battle-arena agents (0G).
 *
 * Agents are registered by their owner (or the platform), and arena match
 * results are recorded by the platform (which orchestrates matches server-side).
 * Each win grants Neurons — the agent's on-chain progression score.
 *
 * Single-admin pattern, mirroring SkillMarketplace.sol (no external libs).
 */
contract AgentRegistry {
    struct AgentRecord {
        address owner;
        string name;
        uint32 wins;
        uint32 losses;
        uint32 neurons; // progression score (10 per win)
        bool exists;
    }

    // ─── State ────────────────────────────────────────────────────────────
    address public admin;
    uint32 public neuronsPerWin;

    mapping(address => AgentRecord) public agents;
    address[] public agentList; // enumeration for the leaderboard

    // ─── Events ───────────────────────────────────────────────────────────
    event AgentRegistered(address indexed agent, address indexed owner, string name);
    event MatchRecorded(address indexed winner, address indexed loser, uint32 winnerNeurons);

    constructor() {
        admin = msg.sender;
        neuronsPerWin = 10;
    }

    // ─── Registration ─────────────────────────────────────────────────────
    /**
     * @notice Register an agent. Callable by the platform (admin) or the agent's
     *         owner. Idempotent — updates the name if already registered.
     */
    function registerAgent(address agent, address owner, string calldata name) public {
        require(agent != address(0), "Zero agent");
        require(msg.sender == admin || msg.sender == owner, "Not authorized");

        AgentRecord storage rec = agents[agent];
        if (!rec.exists) {
            rec.exists = true;
            rec.owner = owner;
            agentList.push(agent);
            emit AgentRegistered(agent, owner, name);
        }
        rec.name = name;
    }

    // ─── Match recording ──────────────────────────────────────────────────
    /**
     * @notice Record a match result. Admin-only (matches are orchestrated by
     *         the platform wallet). Auto-registers unknown agents so a match can
     *         always be recorded.
     */
    function recordMatch(
        address winner,
        string calldata winnerName,
        address loser,
        string calldata loserName
    ) external {
        require(msg.sender == admin, "Admin only");
        require(winner != address(0) && loser != address(0), "Zero agent");
        require(winner != loser, "Same agent");

        _ensure(winner, winnerName);
        _ensure(loser, loserName);

        AgentRecord storage w = agents[winner];
        AgentRecord storage l = agents[loser];
        w.wins += 1;
        w.neurons += neuronsPerWin;
        l.losses += 1;

        emit MatchRecorded(winner, loser, w.neurons);
    }

    function _ensure(address agent, string calldata name) internal {
        AgentRecord storage rec = agents[agent];
        if (!rec.exists) {
            rec.exists = true;
            rec.owner = agent; // owner unknown at record time; defaults to self
            agentList.push(agent);
            rec.name = name;
            emit AgentRegistered(agent, agent, name);
        } else if (bytes(rec.name).length == 0 && bytes(name).length != 0) {
            rec.name = name;
        }
    }

    // ─── Admin ────────────────────────────────────────────────────────────
    function setNeuronsPerWin(uint32 value) external {
        require(msg.sender == admin, "Admin only");
        neuronsPerWin = value;
    }

    // ─── Views ────────────────────────────────────────────────────────────
    function getAgent(address agent) external view returns (AgentRecord memory) {
        return agents[agent];
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }
}
