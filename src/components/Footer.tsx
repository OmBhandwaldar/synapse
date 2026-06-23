import React from "react";

export function Footer() {
  return (
    <footer className="mt-auto pt-8 pb-6 relative">
      {/* Cosmic divider */}
      <div className="punk-divider mb-8" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-sm text-violetBright tracking-tight uppercase">SYNAPSE</span>
          <span className="text-streetGray">|</span>
          <span className="text-streetGray text-sm font-body">Built in Zero Gravity on 0G</span>
        </div>

        <span className="font-mono text-[10px] text-streetGray uppercase tracking-[0.25em] opacity-70">
          Autonomous Agent Skill Marketplace
        </span>
      </div>
    </footer>
  );
}
