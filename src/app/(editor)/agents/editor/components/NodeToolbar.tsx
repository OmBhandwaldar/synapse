"use client";

import React, { DragEvent } from "react";
import { Wallet, Bot, Code } from "lucide-react";
import type { NodeType } from "../types/nodes";

const toolbarItems: {
  type: NodeType;
  label: string;
  jpLabel: string;
  icon: React.ElementType;
  stickerClass: string;
}[] = [
  {
    type: "wallet",
    label: "Wallet",
    jpLabel: "財布",
    icon: Wallet,
    stickerClass: "sticker-pink",
  },
  {
    type: "agent",
    label: "Agent",
    jpLabel: "代理",
    icon: Bot,
    stickerClass: "sticker-purple",
  },
  {
    type: "skill",
    label: "Skill",
    jpLabel: "技能",
    icon: Code,
    stickerClass: "sticker-green",
  },
];

export function NodeToolbar() {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="absolute top-4 left-4 z-20 punk-card min-w-[180px]">
      {/* Header */}
      <div className="bg-inkBlack px-4 py-3 border-b-3 border-inkBlack rounded-t-[13px]">
        <h2 className="font-heading text-xs text-white uppercase tracking-widest">
          Nodes
        </h2>
        <span className="jp-accent-visible text-[10px] text-white/40 block mt-0.5">
          ノードエディタ
        </span>
      </div>

      {/* Node items */}
      <div className="p-3 space-y-2">
        <p className="text-[10px] text-mutedText uppercase tracking-wider mb-2">
          Drag to canvas ↓
        </p>
        {toolbarItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              className={`sticker ${item.stickerClass} !transform-none cursor-grab active:cursor-grabbing flex items-center gap-2 w-full !py-2 !px-3 hover:scale-105 transition-transform`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1">{item.label}</span>
              <span className="opacity-50 text-[9px]">{item.jpLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Punk divider */}
      <div className="punk-divider" />

      {/* Info */}
      <div className="p-3">
        <p className="text-[10px] text-streetGray leading-relaxed">
          Connect <span className="text-punkPink font-bold">Wallet</span> →{" "}
          <span className="text-punkPurple font-bold">Agent</span> to deploy
          <br />
          Connect <span className="text-punkGreen font-bold">Skill</span> →{" "}
          <span className="text-punkPurple font-bold">Agent</span> to equip
          <br />
          Connect <span className="text-punkPurple font-bold">Agent</span> →{" "}
          <span className="text-punkPurple font-bold">Agent</span> to battle
        </p>
      </div>
    </div>
  );
}
