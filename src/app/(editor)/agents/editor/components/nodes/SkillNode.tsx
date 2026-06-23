"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Code, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { SkillNodeData } from "../../types/nodes";

import { useAlgorandWallet } from "@/components/Providers";
import { useDialog } from "@/components/DialogProvider";

function SkillNodeComponent({ id, data }: NodeProps & { data: SkillNodeData & { id: number } }) {
  const { activeAddress } = useAlgorandWallet();
  const { setNodes, setEdges } = useReactFlow();
  const { confirm } = useDialog();
  const [expanded, setExpanded] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeSource, setCodeSource] = useState(data.code?.source || "");
  const [loadError, setLoadError] = useState("");

  const typeColors: Record<string, string> = {
    Logic: "sticker-green",
    Compute: "sticker-blue",
    State: "sticker-purple",
    Data: "sticker-orange",
    Prediction: "sticker-pink",
    Strategy: "sticker-yellow",
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm("Are you sure you want to remove this skill node?")) {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }
  };

  const handleToggleExpand = async () => {
    const nextState = !expanded;
    setExpanded(nextState);

    if (nextState && !codeSource && data.id) {
      if (!activeAddress) {
        setLoadError("Connect wallet to view code");
        return;
      }
      setLoadingCode(true);
      setLoadError("");
      try {
        const res = await fetch(`/api/skills/${data.id}/content`, {
          headers: {
            Authorization: `Bearer ${activeAddress}`
          }
        });
        if (res.status === 402) {
          setLoadError("Purchase required to decrypt");
        } else if (!res.ok) {
          setLoadError("Failed to load code from IPFS");
        } else {
          const body = await res.json();
          setCodeSource(body.source);
        }
      } catch (err) {
        console.error("Fetch code error:", err);
        setLoadError("Connection error");
      } finally {
        setLoadingCode(false);
      }
    }
  };

  return (
    <div className="punk-card punk-card-green node-appear min-w-[220px]">
      {/* Header */}
      <div className="bg-punkGreen px-4 py-2 flex items-center gap-2 border-b-3 border-inkBlack">
        <Code className="w-4 h-4 text-inkBlack" />
        <span className="font-heading text-xs text-inkBlack uppercase tracking-wider truncate max-w-[120px]">
          {data.name || "Skill"}
        </span>
        <button
          onClick={handleDelete}
          className="ml-auto text-inkBlack hover:text-punkRed transition-colors p-1"
          title="Delete Skill Node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2">
        {/* Type badge + version */}
        <div className="flex items-center gap-2">
          <span
            className={`sticker ${typeColors[data.type] || "sticker-dark"} !text-[9px] !py-0.5 !px-1.5 !transform-none`}
          >
            {data.type}
          </span>
          <span className="text-[10px] font-mono text-streetGray">
            v{data.version}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-streetGray leading-snug line-clamp-2">
          {data.description}
        </p>

        {/* Entry point */}
        <div className="font-mono text-[11px] text-punkPurple bg-bgCream px-2 py-1 rounded border-2 border-borderSoft">
          ƒ {data.entry_point || "compute"}()
        </div>

        {/* Expandable code preview */}
        <button
          onClick={handleToggleExpand}
          className="flex items-center gap-1 text-[10px] text-streetGray hover:text-punkPink transition-colors w-full"
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          {expanded ? "Hide Code" : "Show Code"}
        </button>

        {expanded && (
          <div className="mt-2">
            {loadingCode ? (
              <div className="text-[10px] font-mono text-streetGray animate-pulse">Decrypting from IPFS...</div>
            ) : loadError ? (
              <div className="text-[10px] font-mono text-punkRed font-bold">{loadError}</div>
            ) : (
              <pre className="text-[10px] font-mono bg-inkBlack text-punkGreen p-2 rounded overflow-x-auto max-h-[120px] overflow-y-auto border-2 border-inkBlack">
                {codeSource}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Output handle — connects to Agent */}
      <Handle
        type="source"
        position={Position.Right}
        id="skill-out"
        className="!bg-punkYellow"
      />
    </div>
  );
}


export const SkillNode = memo(SkillNodeComponent);
