"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "./ui/Badge";

export type MatchStatus = "LIVE" | "BETTING" | "WAITING" | "SETTLED";

export interface MatchCardProps {
  status: MatchStatus;
  gameType: string;
  stake: string;
  p1: { name: string; winRate: string };
  p2: { name: string; winRate: string };
  winnerName?: string;
  href?: string;
  className?: string;
}

const STATUS_CONFIG = {
  LIVE: {
    badgeColor: "red" as const,
    label: "● LIVE",
    cardAccent: "punk-card-pink",
    vsColor: "text-punkRed",
  },
  BETTING: {
    badgeColor: "purple" as const,
    label: "BETTING",
    cardAccent: "punk-card-purple",
    vsColor: "text-punkPurple",
  },
  WAITING: {
    badgeColor: "dark" as const,
    label: "WAITING",
    cardAccent: "",
    vsColor: "text-streetGray",
  },
  SETTLED: {
    badgeColor: "green" as const,
    label: "SETTLED",
    cardAccent: "punk-card-green",
    vsColor: "text-punkGreen",
  },
};

export function MatchCard({
  status,
  gameType,
  stake,
  p1,
  p2,
  winnerName,
  href = "/arena",
  className = ""
}: MatchCardProps) {
  const config = STATUS_CONFIG[status];
  const isWaiting = status === "WAITING";

  return (
    <div
      className={`punk-card ${config.cardAccent} ${className} ${isWaiting ? "opacity-60 hover:opacity-100 transition-opacity" : ""}`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <Badge label={gameType} color="dark" />
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-streetGray font-bold">{stake}</span>
            <Badge label={config.label} color={config.badgeColor} />
          </div>
        </div>

        {/* Versus Section */}
        <div className="flex justify-between items-center">
          <div className="text-center w-2/5 min-w-0">
            <p className="text-inkBlack font-body font-bold truncate text-lg">{p1.name}</p>
            <p className="text-streetGray text-xs font-mono mt-1">{p1.winRate} WR</p>
          </div>
          
          <div className={`w-1/5 text-center font-heading text-2xl ${config.vsColor}`}>
            VS
          </div>
          
          <div className="text-center w-2/5 min-w-0">
            {isWaiting && p2.name === "Open Slot" ? (
              <p className="text-mutedText font-body italic text-sm">Open Slot</p>
            ) : (
              <>
                <p className="text-inkBlack font-body font-bold truncate text-lg">{p2.name}</p>
                <p className="text-streetGray text-xs font-mono mt-1">{p2.winRate} WR</p>
              </>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="mt-6 pt-4 border-t-2 border-borderSoft">
          {status === "SETTLED" ? (
            <div className="text-center font-mono text-xs">
              <span className="text-streetGray block mb-1">OUTCOME</span>
              <span className="font-heading text-sm text-punkGreen uppercase">
                {winnerName ? `🏆 ${winnerName} Wins` : "🤝 Draw / Refunded"}
              </span>
            </div>
          ) : status === "BETTING" ? (
            <div className="flex gap-3">
              <button className="flex-1 punk-btn bg-punkPurple/10 text-punkPurple text-xs py-2 rounded-lg border-2 border-punkPurple">
                Bet {p1.name.split('_')[0]}
              </button>
              <button className="flex-1 punk-btn bg-punkPink/10 text-punkPink text-xs py-2 rounded-lg border-2 border-punkPink">
                Bet {p2.name.split('_')[0]}
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Link 
                href={href} 
                className={`font-body font-bold text-sm uppercase tracking-wider hover:underline transition-colors ${
                  isWaiting ? "text-streetGray hover:text-inkBlack" : "text-punkPink hover:text-punkPurple"
                }`}
              >
                {status === "LIVE" ? "Spectate →" : "Join Fight →"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
