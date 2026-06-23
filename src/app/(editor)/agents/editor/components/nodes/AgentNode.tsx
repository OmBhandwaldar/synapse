"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Bot, Swords, Zap, Trash2 } from "lucide-react";
import type { AgentNodeData } from "../../types/nodes";
import { useDialog } from "@/components/DialogProvider";

function AgentNodeComponent({ id, data }: NodeProps & { data: AgentNodeData }) {
  const { setNodes, setEdges } = useReactFlow();
  const { confirm } = useDialog();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm("Are you sure you want to remove this agent node?")) {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }
  };

  const truncatedAddr = data.address
    ? `${data.address.slice(0, 6)}...${data.address.slice(-4)}`
    : "No Address";

  const statusColors: Record<string, string> = {
    idle: "bg-streetGray",
    deployed: "bg-punkGreen",
    "in-match": "bg-punkPink",
  };

  const statusLabels: Record<string, string> = {
    idle: "Idle",
    deployed: "Deployed",
    "in-match": "In Match",
  };

  return (
    <div className="punk-card punk-card-purple node-appear min-w-[240px]">
      {/* Wallet input handle — left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="agent-wallet-in"
        className="!bg-punkPink"
        style={{ top: "30px" }}
      />

      {/* Skill input handle — top */}
      <Handle
        type="target"
        position={Position.Top}
        id="agent-skill-in"
        className="!bg-punkGreen"
      />

      {/* Header */}
      <div className="bg-punkPurple px-4 py-2 flex items-center gap-2 border-b-3 border-inkBlack">
        <Bot className="w-4 h-4 text-white" />
        <span className="font-heading text-xs text-white uppercase tracking-wider truncate max-w-[120px]">
          {data.name || "Agent"}
        </span>
        <button
          onClick={handleDelete}
          className="ml-auto text-white/80 hover:text-punkRed transition-colors p-1"
          title="Delete Agent Node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${statusColors[data.status] || "bg-streetGray"}`}
          />
          <span className="text-xs font-mono text-streetGray">
            {statusLabels[data.status] || "Unknown"}
          </span>
        </div>

        {/* Address */}
        <div className="font-mono text-xs text-inkDark bg-bgCream px-2 py-1 rounded border-2 border-borderSoft">
          {truncatedAddr}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <Swords className="w-3 h-3 text-punkPink" />
            <span className="font-bold">
              {data.stats.wins}W / {data.stats.losses}L
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-punkYellow" />
            <span className="font-bold">{data.stats.neurons} Neurons</span>
          </div>
        </div>

        {/* Equipped skills count */}
        <div className="flex items-center gap-1 text-xs text-streetGray">
          <span className="sticker sticker-green !text-[9px] !py-0.5 !px-1.5 !transform-none">
            {data.skills.length} Skills
          </span>
        </div>
      </div>

      {/* Output handle — connects to other Agent for match */}
      <Handle
        type="source"
        position={Position.Right}
        id="agent-match-out"
        className="!bg-punkOrange"
      />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
