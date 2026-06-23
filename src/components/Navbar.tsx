"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAlgorandWallet } from "./Providers";
import WalletConnectionModal from "./WalletConnectionModal";
import WalletAccountModal from "./WalletAccountModal";

const NAV_ITEMS = [
  { label: "Home", href: "/", jp: "ホーム" },
  { label: "Arena", href: "/arena", jp: "アリーナ" },
  { label: "Predictions", href: "/predictions", jp: "予測" },
  { label: "Market", href: "/marketplace", jp: "市場" },
  { label: "Agents", href: "/agents", jp: "エージェント" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { activeAddress } = useAlgorandWallet();
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  // Helper to truncate address
  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0613]/80 backdrop-blur-md border-b border-[rgba(139,92,246,0.18)]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-20">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="font-pixel text-base md:text-lg text-violetBright uppercase tracking-tight group-hover:text-glow transition-all">
            SYNAPSE
          </span>
          <span className="font-mono text-[10px] text-streetGray font-medium uppercase tracking-[0.2em] opacity-70 hidden sm:inline">
             on 0G
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  relative px-4 py-2 font-body font-semibold text-sm uppercase tracking-wider rounded-lg transition-all duration-200
                  ${isActive
                    ? "bg-violet/20 text-violetBright border border-[rgba(139,92,246,0.5)] shadow-[0_0_16px_rgba(139,92,246,0.35)]"
                    : "text-streetGray hover:bg-violet/10 hover:text-violetBright"
                  }
                `}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Connect Wallet */}
        <div className="relative">
          <button 
            onClick={() => activeAddress ? setIsAccountOpen(true) : setIsConnectOpen(true)}
            className="punk-btn bg-violet text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            {activeAddress ? truncateAddress(activeAddress) : "Connect Wallet"}
          </button>
        </div>
      </div>

      <WalletConnectionModal 
        isOpen={isConnectOpen} 
        onClose={() => setIsConnectOpen(false)} 
      />

      <WalletAccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
      />

      {/* Mobile Nav */}
      <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-3 -mt-1 scrollbar-hide">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                whitespace-nowrap px-3 py-1.5 font-body font-bold text-xs uppercase tracking-wider rounded-md transition-all
                ${isActive
                  ? "bg-violet/20 text-violetBright border border-[rgba(139,92,246,0.4)]"
                  : "text-streetGray hover:text-violetBright"
                }
              `}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
