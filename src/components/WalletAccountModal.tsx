'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAlgorandWallet } from './Providers'

interface WalletAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WalletAccountModal({ isOpen, onClose }: WalletAccountModalProps) {
  const { activeAddress, walletType, disconnect } = useAlgorandWallet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!isOpen || !mounted || !activeAddress) return null

  const handleDisconnect = async () => {
    await disconnect()
    onClose()
  }

  const walletIcon = '🦊'
  const walletName = walletType?.toUpperCase() || 'WALLET'

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
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
            <span className="bg-punkYellow text-inkBlack px-2 w-fit mb-1">CONNECTED</span> 
            <span className="text-inkBlack">ACCOUNT</span>
          </h2>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xl">{walletIcon}</span>
            <span className="font-heading text-streetGray text-sm">{walletName} PROVIDER</span>
          </div>
        </div>

        <div className="bg-white border-2 border-inkBlack p-4 mb-8 font-mono break-all text-xs text-inkBlack shadow-[4px_4px_0px_#1A1A1A]">
          {activeAddress}
        </div>

        <button
          onClick={handleDisconnect}
          className="punk-btn w-full bg-punkPink text-white hover:bg-punkRed transition-all p-4"
        >
          <span className="font-heading text-lg">DISCONNECT</span>
        </button>

        <div className="mt-8 pt-6 border-t-2 border-dashed border-streetGray/30 text-[9px] text-center text-streetGray font-mono uppercase tracking-widest opacity-60">
          Shibuya Punk Protocol // Secure Bridge
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body)
}
