import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAlgorandWallet, WalletType } from './Providers'

interface WalletConnectionModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WalletConnectionModal({ isOpen, onClose }: WalletConnectionModalProps) {
  const { connect } = useAlgorandWallet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!isOpen || !mounted) return null

  const wallets = [
    { id: WalletType.METAMASK, name: 'MetaMask', icon: '🦊', connect },
  ]

  const handleConnect = async (wallet: typeof wallets[0]) => {
    try {
      await wallet.connect()
      onClose()
    } catch (e) {
      console.error('Failed to connect:', e)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div 
        className="punk-card w-full max-w-sm bg-bgCream p-8 relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-inkBlack hover:text-punkPink transition-colors p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-8">
          <h2 className="text-3xl flex flex-col leading-none">
            <span className="bg-punkYellow text-inkBlack px-2 w-fit mb-1">CONNECT</span> 
            <span className="text-inkBlack">WALLET</span>
          </h2>
          <p className="text-[10px] text-streetGray font-mono mt-2 uppercase tracking-tighter">Connect to 0G Galileo Testnet</p>
        </div>

        <div className="space-y-4">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleConnect(wallet)}
              className="punk-btn w-full bg-white hover:bg-punkYellow transition-all flex items-center gap-4 p-4 group"
            >
              <span className="text-2xl group-hover:scale-125 transition-transform">{wallet.icon}</span>
              <span className="font-heading text-lg text-inkBlack">{wallet.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t-2 border-dashed border-streetGray/30 text-[9px] text-center text-streetGray font-mono uppercase tracking-widest opacity-60">
          Shibuya Punk Protocol // 0G Galileo Testnet
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body)
}
