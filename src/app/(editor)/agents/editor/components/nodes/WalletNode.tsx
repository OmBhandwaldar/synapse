"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Wallet, Trash2 } from "lucide-react";
import type { WalletNodeData } from "../../types/nodes";
import { useAlgorandWallet } from "@/components/Providers";
import WalletConnectionModal from "@/components/WalletConnectionModal";
import { useDialog } from "@/components/DialogProvider";

function WalletNodeComponent({ id, data }: NodeProps & { data: WalletNodeData & { isMain?: boolean; onAddressChange?: (id: string, addr: string) => void } }) {
  const { activeAddress } = useAlgorandWallet();
  const { setNodes, setEdges } = useReactFlow();
  const { confirm } = useDialog();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use real activeAddress for main wallet node, otherwise use custom user input
  const isMain = data.isMain !== false; // defaults to true if not specified
  const address = isMain ? activeAddress : data.address;
  const isConnected = isMain ? !!activeAddress : !!data.address;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm("Are you sure you want to remove this wallet node?")) {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }
  };

  const truncatedAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Click to Connect";

  return (
    <>
      <div 
        className={`punk-card ${isMain ? 'punk-card-pink' : 'punk-card-orange'} node-appear min-w-[220px] cursor-pointer hover:scale-102 transition-transform`}
        onClick={() => {
          if (isMain) setIsModalOpen(true);
        }}
      >
        {/* Header */}
        <div className={`px-4 py-2 flex items-center gap-2 border-b-3 border-inkBlack ${isMain ? 'bg-punkPink' : 'bg-punkOrange'}`}>
          <Wallet className={`w-4 h-4 ${isMain ? 'text-white' : 'text-inkBlack'}`} />
          <span className={`font-heading text-xs uppercase tracking-wider ${isMain ? 'text-white' : 'text-inkBlack'}`}>
            {isMain ? "Main Wallet" : "Custom Wallet"}
          </span>
          {!isMain && (
            <button
              onClick={handleDelete}
              className="ml-auto text-inkBlack hover:text-punkRed transition-colors p-1"
              title="Delete Wallet Node"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {isMain && (
            <span className="jp-accent-visible text-[10px] ml-auto text-white/60">
              財布
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-punkGreen" : "bg-punkRed"
              }`}
            />
            <span className="text-xs font-mono text-streetGray">
              {isConnected ? "Ready" : "Not Set"}
            </span>
          </div>

          {isMain ? (
            <div className="font-mono text-sm font-bold text-inkBlack bg-bgCream px-2 py-1 rounded border-2 border-borderSoft text-center truncate">
              {truncatedAddr}
            </div>
          ) : (
            <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
              <label className="text-[9px] font-mono text-streetGray uppercase block">Algorand Address</label>
              <input
                type="text"
                placeholder="Paste ALGO address..."
                value={data.address || ""}
                onChange={(e) => {
                  if (data.onAddressChange) {
                    data.onAddressChange(id, e.target.value);
                  }
                }}
                className="w-full font-mono text-[10px] p-2 bg-white border-2 border-inkBlack focus:outline-none focus:border-punkPink rounded text-inkBlack"
              />
            </div>
          )}
        </div>

        {/* Output handle — connects to Agent */}
        <Handle
          type="source"
          position={Position.Right}
          id="wallet-out"
          className="!bg-punkYellow"
        />
      </div>

      <WalletConnectionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}


export const WalletNode = memo(WalletNodeComponent);
