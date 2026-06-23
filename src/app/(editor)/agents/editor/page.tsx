"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import { nodeTypes } from "./components/nodes";
import { NodeToolbar } from "./components/NodeToolbar";
import type {
  WalletNodeData,
  AgentNodeData,
  SkillNodeData,
  NodeType,
} from "./types/nodes";
import { VALID_CONNECTIONS } from "./types/nodes";
import { useAlgorandWallet } from "@/components/Providers";
import { useDialog } from "@/components/DialogProvider";

let nodeIdCounter = 1000;

function NodeEditorCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { activeAddress } = useAlgorandWallet();
  const { alert, confirm, prompt } = useDialog();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);

  // Callback for when a custom wallet address changes
  const handleAddressChange = useCallback((id: string, newAddress: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              address: newAddress,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Load real data from APIs and merge with cached layout
  const loadData = useCallback(async () => {
    if (!activeAddress) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch real agents
      const agentRes = await fetch(`/api/agent/list?owner=all`);
      const agentData = await agentRes.json();
      const allDbAgents = agentData.agents ?? [];

      // Get list of all wallets we manage from localStorage cache
      const cacheKey = `cortex-layout-${activeAddress}`;
      const cacheStr = localStorage.getItem(cacheKey);
      let cachedCustomWalletAddresses: string[] = [];
      if (cacheStr) {
        try {
          const cache = JSON.parse(cacheStr);
          const cachedNodes: any[] = cache.nodes || [];
          cachedCustomWalletAddresses = cachedNodes
            .filter((n) => n.type === "wallet" && n.id !== "wallet-main" && n.data?.address)
            .map((n) => n.data.address);
        } catch (e) {
          console.error("Failed to parse custom wallet cache:", e);
        }
      }

      const allowedAddresses = [activeAddress, ...cachedCustomWalletAddresses];

      // Filter: Only keep agents owned by allowedAddresses, OR agents with no owner (null/empty)
      const dbAgents = allDbAgents.filter((agent: any) => 
        !agent.ownerAddress || allowedAddresses.includes(agent.ownerAddress)
      );

      setAvailableAgents(dbAgents);

      // 2. Fetch owned skills
      const skillRes = await fetch(`/api/skills/owned?address=${activeAddress}`);
      const skillData = await skillRes.json();
      const dbSkills = skillData.skills ?? [];
      setAvailableSkills(dbSkills);

      // 3. Build Node & Edge sets (Default view if no cache exists)
      const mainWalletNode: Node = {
        id: "wallet-main",
        type: "wallet",
        position: { x: 80, y: 150 },
        data: {
          address: activeAddress,
          connected: true,
          isMain: true,
        },
      };

      // Only place agents owned by user on canvas by default
      const ownedDbAgents = dbAgents.filter((a: any) => a.ownerAddress === activeAddress);

      const agentNodes: Node[] = ownedDbAgents.map((agent: any, idx: number) => ({
        id: `agent-${agent.agentAddress}`,
        type: "agent",
        position: { x: 380, y: 100 + idx * 220 },
        data: {
          name: agent.agentName,
          address: agent.agentAddress,
          owner: agent.ownerAddress || "",
          skills: [], // populated dynamically based on connections
          stats: { wins: 0, losses: 0, neurons: 0 },
          status: agent.ownerAddress ? "deployed" : "idle",
          code: {
            language: "javascript",
            source: "// equipped skill logic resolved at runtime",
          },
        } satisfies AgentNodeData,
      }));

      // Find which skills are equipped on these agents
      const equippedSkillIds = new Set<number>();
      ownedDbAgents.forEach((agent: any) => {
        if (agent.equippedSkill1) equippedSkillIds.add(Number(agent.equippedSkill1));
        if (agent.equippedSkill2) equippedSkillIds.add(Number(agent.equippedSkill2));
        if (agent.equippedSkill3) equippedSkillIds.add(Number(agent.equippedSkill3));
      });

      const equippedDbSkills = dbSkills.filter((skill: any) => equippedSkillIds.has(Number(skill.id)));

      const skillNodes: Node[] = equippedDbSkills.map((skill: any, idx: number) => ({
        id: `skill-${skill.id}`,
        type: "skill",
        position: { x: 680, y: 100 + idx * 200 },
        data: {
          id: skill.id,
          cortex_skill_version: "1.0",
          name: skill.name,
          type: skill.skillType as any,
          version: skill.version,
          description: skill.description,
          entry_point: skill.entryPoint || "compute",
          parameters: skill.parameters || {},
          code: {
            language: "javascript",
            source: "",
          },
          metadata: {
            author: skill.seller,
            tags: [skill.skillType.toLowerCase()],
            min_agent_version: "1.0",
          },
        } satisfies SkillNodeData & { id: number },
      }));

      let initialNodesList = [mainWalletNode, ...agentNodes, ...skillNodes];
      let initialEdgesList: Edge[] = [];

      // Recreate edges from database state for equipped skills
      ownedDbAgents.forEach((agent: any) => {
        const agentNodeId = `agent-${agent.agentAddress}`;
        const skillIds = [agent.equippedSkill1, agent.equippedSkill2, agent.equippedSkill3].filter(Boolean);

        skillIds.forEach((skillId) => {
          initialEdgesList.push({
            id: `db-edge-${agentNodeId}-skill-${skillId}`,
            source: `skill-${skillId}`,
            target: agentNodeId,
            sourceHandle: "skill-out",
            targetHandle: "agent-skill-in",
          });
        });

        // Recreate edges from database for wallet ownership
        initialEdgesList.push({
          id: `db-edge-wallet-main-${agentNodeId}`,
          source: "wallet-main",
          target: agentNodeId,
          sourceHandle: "wallet-out",
          targetHandle: "agent-wallet-in",
          animated: true,
        });
      });

      // 4. Merge with localStorage Layout Cache
      if (cacheStr) {
        try {
          const cache = JSON.parse(cacheStr);
          const cachedNodes: Node[] = cache.nodes || [];
          const cachedEdges: Edge[] = cache.edges || [];

          // Add cached nodes, updating their data from the database
          const mergedNodes: Node[] = [];
          cachedNodes.forEach((cached) => {
            if (cached.id === "wallet-main") {
              mergedNodes.push({
                ...cached,
                data: {
                  ...cached.data,
                  address: activeAddress,
                  connected: !!activeAddress,
                  isMain: true,
                },
              });
            } else if (cached.type === "wallet") {
              mergedNodes.push({
                ...cached,
                data: {
                  ...cached.data,
                  onAddressChange: handleAddressChange,
                },
              });
            } else if (cached.type === "agent") {
              const dbAgent = dbAgents.find((a: any) => `agent-${a.agentAddress}` === cached.id);
              if (dbAgent) {
                mergedNodes.push({
                  ...cached,
                  data: {
                    ...cached.data,
                    name: dbAgent.agentName,
                    address: dbAgent.agentAddress,
                    owner: dbAgent.ownerAddress || "",
                    status: dbAgent.ownerAddress ? "deployed" : "idle",
                  },
                });
              }
            } else if (cached.type === "skill") {
              const dbSkill = dbSkills.find((s: any) => `skill-${s.id}` === cached.id);
              if (dbSkill) {
                mergedNodes.push({
                  ...cached,
                  data: {
                    ...cached.data,
                    name: dbSkill.name,
                    type: dbSkill.skillType,
                    version: dbSkill.version,
                    description: dbSkill.description,
                  },
                });
              }
            } else {
              mergedNodes.push(cached);
            }
          });

          // Add any new owned agents that are not in the cache yet
          ownedDbAgents.forEach((agent: any, idx: number) => {
            const nodeId = `agent-${agent.agentAddress}`;
            if (!mergedNodes.some((mn) => mn.id === nodeId)) {
              mergedNodes.push({
                id: nodeId,
                type: "agent",
                position: { x: 380, y: 100 + idx * 220 },
                data: {
                  name: agent.agentName,
                  address: agent.agentAddress,
                  owner: agent.ownerAddress || "",
                  skills: [],
                  stats: { wins: 0, losses: 0, neurons: 0 },
                  status: agent.ownerAddress ? "deployed" : "idle",
                  code: {
                    language: "javascript",
                    source: "// equipped skill logic resolved at runtime",
                  },
                },
              });
            }
          });

          // Add any new equipped skills that are not in the cache yet
          equippedDbSkills.forEach((skill: any, idx: number) => {
            const nodeId = `skill-${skill.id}`;
            if (!mergedNodes.some((mn) => mn.id === nodeId)) {
              mergedNodes.push({
                id: nodeId,
                type: "skill",
                position: { x: 680, y: 100 + idx * 200 },
                data: {
                  id: skill.id,
                  cortex_skill_version: "1.0",
                  name: skill.name,
                  type: skill.skillType,
                  version: skill.version,
                  description: skill.description,
                  entry_point: skill.entryPoint || "compute",
                  parameters: skill.parameters || {},
                  code: {
                    language: "javascript",
                    source: "",
                  },
                  metadata: {
                    author: skill.seller,
                    tags: [skill.skillType.toLowerCase()],
                    min_agent_version: "1.0",
                  },
                },
              });
            }
          });

          // Keep cached edges if their source and target nodes still exist
          const mergedEdges = cachedEdges.filter(edge => 
            mergedNodes.some(n => n.id === edge.source) && 
            mergedNodes.some(n => n.id === edge.target)
          );

          // Add any missing database edges
          initialEdgesList.forEach((dbEdge) => {
            const exists = mergedEdges.some(
              (me) => me.source === dbEdge.source && me.target === dbEdge.target
            );
            if (!exists && mergedNodes.some(n => n.id === dbEdge.source) && mergedNodes.some(n => n.id === dbEdge.target)) {
              mergedEdges.push(dbEdge);
            }
          });

          setNodes(mergedNodes);
          setEdges(mergedEdges);
        } catch (e) {
          console.error("Failed to parse layout cache:", e);
          setNodes(initialNodesList);
          setEdges(initialEdgesList);
        }
      } else {
        setNodes(initialNodesList);
        setEdges(initialEdgesList);
      }
    } catch (err) {
      console.error("Failed to load swarm data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAddress, handleAddressChange, setNodes, setEdges]);

  // Reload data when active address changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Connection validation
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    // Lookup types dynamically
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const sourceType = sourceNode.type as NodeType;
    const targetType = targetNode.type as NodeType;

    // Check mapping rules
    if (!VALID_CONNECTIONS[sourceType]?.includes(targetType)) return false;

    // Custom rule: Agent wallet-in handle can only accept 1 connection
    if (connection.targetHandle === "agent-wallet-in") {
      const existingWalletEdge = edges.some(
        (e) => e.target === connection.target && e.targetHandle === "agent-wallet-in"
      );
      if (existingWalletEdge) return false;
    }

    // Custom rule: Agent skill-in handle can accept up to 3 connections
    if (connection.targetHandle === "agent-skill-in") {
      const existingSkillEdges = edges.filter(
        (e) => e.target === connection.target && e.targetHandle === "agent-skill-in"
      );
      if (existingSkillEdges.length >= 3) return false;
    }

    return true;
  }, [nodes, edges]);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const isWallet = connection.targetHandle === "agent-wallet-in";
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: isWallet, // make wallet connection lines animated/live!
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Handle edge click to delete connections
  const onEdgeClick = useCallback(
    async (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      if (await confirm("Remove this connection?")) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
    },
    [setEdges, confirm]
  );

  // Auto-cache visual positions/connections locally on changes
  useEffect(() => {
    if (activeAddress && nodes.length > 0) {
      const cacheKey = `cortex-layout-${activeAddress}`;
      localStorage.setItem(cacheKey, JSON.stringify({ nodes, edges }));
    }
  }, [nodes, edges, activeAddress]);

  // Handle save swarm config to database
  const saveSwarm = async () => {
    if (!activeAddress) return;
    setSaveStatus("saving");
    setSaveMessage("Updating database...");

    try {
      // 1. Get the list of custom wallet addresses currently on the canvas
      const customWalletAddresses = nodes
        .filter((n) => n.type === "wallet" && n.id !== "wallet-main")
        .map((n) => n.data.address)
        .filter(Boolean);

      const allowedWallets = [activeAddress, ...customWalletAddresses];

      // 2. Identify agents that are owned by allowedWallets but NOT present on the canvas anymore
      const canvasAgentAddresses = nodes.filter((n) => n.type === "agent").map((n) => n.data.address);
      const removedAgents = availableAgents.filter(
        (a) => !canvasAgentAddresses.includes(a.agentAddress) && 
               a.ownerAddress && allowedWallets.includes(a.ownerAddress)
      );

      // 3. Map active connections
      const activeConnections = nodes
        .filter((n) => n.type === "agent")
        .map((agentNode) => {
          const agentAddress = agentNode.data.address;

          // Find connected wallet
          const walletEdge = edges.find(
            (e) => e.target === agentNode.id && e.targetHandle === "agent-wallet-in"
          );
          let ownerAddress = null;
          if (walletEdge) {
            const walletNode = nodes.find((n) => n.id === walletEdge.source);
            if (walletNode) {
              ownerAddress = walletNode.id === "wallet-main" ? activeAddress : walletNode.data.address;
            }
          }

          // Find connected skills (up to 3)
          const skillEdges = edges.filter(
            (e) => e.target === agentNode.id && e.targetHandle === "agent-skill-in"
          );
          const skills: number[] = [];
          skillEdges.forEach((edge) => {
            const skillNode = nodes.find((n) => n.id === edge.source);
            if (skillNode && skillNode.data.id) {
              skills.push(Number(skillNode.data.id));
            }
          });

          return {
            agentAddress,
            ownerAddress,
            skills,
          };
        });

      // 4. Combine active and removed connections
      const connections = [
        ...activeConnections,
        ...removedAgents.map((a) => ({
          agentAddress: a.agentAddress,
          ownerAddress: null, // Reset owner
          skills: [], // Clear skills
        })),
      ];

      // 5. Post to backend
      const res = await fetch("/api/agent/save-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connections }),
      });

      if (!res.ok) {
        throw new Error("Failed to save layout to database");
      }

      setSaveStatus("saved");
      setSaveMessage("Swarm persisted successfully! ⚡");
      // Reload fresh layout to make sure DB sync is perfectly in line with visual canvas
      await loadData();
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveStatus("error");
      setSaveMessage(err.message || "Failed to save configuration");
    }
  };

  // Handle drag over canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop from toolbar
  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as NodeType;
      if (!type) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 40,
      };

      if (type === "wallet") {
        const address = await prompt("Paste your Algorand wallet address to connect:");
        if (!address) return;
        const cleaned = address.trim();
        if (cleaned.length !== 58 || !/^[A-Z2-7]+$/.test(cleaned)) {
          await alert("Invalid Algorand wallet address format. Connection aborted.");
          return;
        }

        const nodeId = `wallet-manual-${cleaned.slice(0, 8)}`;
        if (nodes.some((n) => n.id === nodeId)) {
          await alert("This wallet node is already on the canvas.");
          return;
        }

        const newNode: Node = {
          id: nodeId,
          type: "wallet",
          position,
          data: {
            isMain: false,
            address: cleaned,
            connected: true,
            onAddressChange: handleAddressChange,
          },
        };
        setNodes((nds) => nds.concat(newNode));
      } 
      else if (type === "skill") {
        if (availableSkills.length === 0) {
          await alert("You do not own any skills. Visit the Marketplace to purchase skills.");
          return;
        }
        const promptText = `Select a skill to place (enter number):\n` +
          availableSkills.map((s, idx) => `${idx + 1}. ${s.name} (${s.skillType})`).join("\n");
        const choiceStr = await prompt(promptText);
        if (!choiceStr) return;
        const choiceIdx = parseInt(choiceStr, 10) - 1;
        if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= availableSkills.length) {
          await alert("Invalid selection.");
          return;
        }
        const selectedSkill = availableSkills[choiceIdx];
        const nodeId = `skill-${selectedSkill.id}`;

        if (nodes.some((n) => n.id === nodeId)) {
          await alert(`Skill "${selectedSkill.name}" is already on the canvas.`);
          return;
        }

        const newNode: Node = {
          id: nodeId,
          type: "skill",
          position,
          data: {
            id: selectedSkill.id,
            cortex_skill_version: "1.0",
            name: selectedSkill.name,
            type: selectedSkill.skillType,
            version: selectedSkill.version,
            description: selectedSkill.description,
            entry_point: selectedSkill.entryPoint || "compute",
            parameters: selectedSkill.parameters || {},
            code: {
              language: "javascript",
              source: "",
            },
            metadata: {
              author: selectedSkill.seller,
              tags: [selectedSkill.skillType.toLowerCase()],
              min_agent_version: "1.0",
            },
          },
        };
        setNodes((nds) => nds.concat(newNode));
      } 
      else if (type === "agent") {
        const existingAgentAddresses = nodes.filter((n) => n.type === 'agent').map((n) => n.data.address);
        const unplacedAgents = availableAgents.filter((a) => !existingAgentAddresses.includes(a.agentAddress));

        if (unplacedAgents.length === 0) {
          await alert("All your available agents are already placed on the canvas.");
          return;
        }

        const promptText = `Select an agent to place (enter number):\n` +
          unplacedAgents.map((a, idx) => `${idx + 1}. ${a.agentName}`).join("\n");
        const choiceStr = await prompt(promptText);
        if (!choiceStr) return;
        const choiceIdx = parseInt(choiceStr, 10) - 1;
        if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= unplacedAgents.length) {
          await alert("Invalid selection.");
          return;
        }
        const selectedAgent = unplacedAgents[choiceIdx];
        const nodeId = `agent-${selectedAgent.agentAddress}`;

        const newNode: Node = {
          id: nodeId,
          type: "agent",
          position,
          data: {
            name: selectedAgent.agentName,
            address: selectedAgent.agentAddress,
            owner: selectedAgent.ownerAddress || "",
            skills: [],
            stats: { wins: 0, losses: 0, neurons: 0 },
            status: selectedAgent.ownerAddress ? "deployed" : "idle",
            code: {
              language: "javascript",
              source: "// equipped skill logic resolved at runtime",
            },
          },
        };
        setNodes((nds) => nds.concat(newNode));
      }
    },
    [setNodes, handleAddressChange, nodes, availableSkills, availableAgents, loadData, alert, prompt]
  );

  // MiniMap node color
  const nodeColor = (node: Node) => {
    switch (node.type) {
      case "wallet":
        return "#FF2D8A";
      case "agent":
        return "#9B30FF";
      case "skill":
        return "#39FF14";
      default:
        return "#1A1A1A";
    }
  };

  return (
    <div ref={reactFlowWrapper} className="w-screen h-screen relative">
      {loading ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-bgCream/90 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-punkPurple border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-mono text-sm text-inkBlack uppercase tracking-widest animate-pulse">Loading Swarm Graph...</p>
        </div>
      ) : !activeAddress ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-bgCream stripe-bg p-8 text-center">
          <div className="text-6xl mb-6">🔌</div>
          <h2 className="font-heading text-2xl text-inkBlack uppercase tracking-widest mb-2">Connect Your Wallet</h2>
          <p className="font-mono text-streetGray text-sm max-w-sm mb-6">Connect your wallet to configure your autonomous agent swarm.</p>
          <a href="/agents">
            <button className="bg-inkBlack text-white border-4 border-inkBlack hover:border-punkPink hover:bg-punkPink font-mono font-bold text-sm px-6 py-3 transition-all shadow-[6px_6px_0_#1a1a1a]">
              ← Back to Swarm Page
            </button>
          </a>
        </div>
      ) : null}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        className="bg-bgCream"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="rgba(26, 26, 26, 0.12)"
        />
        <Controls />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>

      {/* Toolbar panel */}
      <NodeToolbar />

      {/* Save Button (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-4">
        <button
          onClick={saveSwarm}
          disabled={saveStatus === "saving" || !activeAddress}
          className="bg-punkPink text-inkBlack border-3 border-inkBlack hover:bg-punkYellow font-heading text-sm px-6 py-3 flex items-center gap-2 hover:-translate-y-0.5 transition-all shadow-[6px_6px_0_#1a1a1a] uppercase font-bold tracking-widest disabled:opacity-50 disabled:pointer-events-none"
        >
          {saveStatus === "saving" ? "Saving..." : "Save Layout & Swarm ⚡"}
        </button>

        {saveStatus !== "idle" && (
          <div
            className={`font-mono text-xs font-bold px-4 py-2 border-2 border-inkBlack shadow-[3px_3px_0_#1a1a1a] rounded ${
              saveStatus === "saved"
                ? "bg-punkGreen text-inkBlack"
                : saveStatus === "error"
                ? "bg-punkRed text-white"
                : "bg-punkYellow text-inkBlack animate-pulse"
            }`}
          >
            {saveMessage}
          </div>
        )}
      </div>

      {/* Top Right Overlay (Title & Back Button) */}
      <div className="absolute top-4 right-4 z-20 text-right flex flex-col items-end gap-3">
        {/* Title overlay */}
        <div className="pointer-events-none">
          <h1 className="font-heading text-xl text-inkBlack opacity-60">
            CORTEX
          </h1>
          <span className="jp-accent-visible text-sm block opacity-60">ノードエディタ</span>
        </div>

        {/* Back button */}
        <div className="pointer-events-auto">
          <a href="/agents" className="inline-block">
            <button className="bg-inkBlack text-white border-2 border-transparent hover:border-punkPink font-mono text-sm px-4 py-2 flex items-center gap-2 hover:-translate-y-0.5 transition-all shadow-[4px_4px_0_#FF2D8A]">
              <span className="text-xl">←</span>
              <span>Back to Agents</span>
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function NodeEditorPage() {
  return (
    <ReactFlowProvider>
      <NodeEditorCanvas />
    </ReactFlowProvider>
  );
}


