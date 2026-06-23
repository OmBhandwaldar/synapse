'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { DialogProvider } from './DialogProvider'
import { ethers } from 'ethers'
import { OG_NETWORK_PARAMS, OG_CHAIN_ID } from '@/lib/og/chain'

// Single wallet type now: MetaMask (EIP-1193) on 0G Chain.
export enum WalletType {
  METAMASK = 'metamask',
}

interface WalletContextType {
  activeAddress: string | null
  walletType: WalletType | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  getSigner: () => Promise<ethers.Signer>
  // Back-compat aliases so existing UI buttons keep working.
  connectPera: () => Promise<void>
  connectDefly: () => Promise<void>
  connectLute: () => Promise<void>
  /** @deprecated Algorand group signing removed. Use getSigner() + contract calls. */
  signTransaction: (txgroups: any[]) => Promise<Uint8Array[]>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

// Name kept for back-compat with existing imports across the app.
export const useAlgorandWallet = () => {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useAlgorandWallet must be used within Providers')
  return context
}
export const useWallet = useAlgorandWallet

function getEthereum(): any {
  if (typeof window === 'undefined') return null
  return (window as any).ethereum ?? null
}

async function ensureOgNetwork(eth: any) {
  const targetHex = '0x' + OG_CHAIN_ID.toString(16)
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] })
  } catch (err: any) {
    // 4902 = chain not added yet
    if (err?.code === 4902) {
      await eth.request({ method: 'wallet_addEthereumChain', params: [OG_NETWORK_PARAMS] })
    } else {
      throw err
    }
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [activeAddress, setActiveAddress] = useState<string | null>(null)
  const [walletType, setWalletType] = useState<WalletType | null>(null)

  // Restore + listen for account changes.
  useEffect(() => {
    const eth = getEthereum()
    if (!eth) return

    const saved = localStorage.getItem('og_wallet_address')
    if (saved) {
      eth.request({ method: 'eth_accounts' }).then((accs: string[]) => {
        if (accs?.length && accs[0].toLowerCase() === saved.toLowerCase()) {
          setActiveAddress(accs[0])
          setWalletType(WalletType.METAMASK)
        } else {
          localStorage.removeItem('og_wallet_address')
        }
      }).catch(() => {})
    }

    const onAccountsChanged = (accs: string[]) => {
      if (accs?.length) {
        setActiveAddress(accs[0])
        setWalletType(WalletType.METAMASK)
        localStorage.setItem('og_wallet_address', accs[0])
      } else {
        setActiveAddress(null)
        setWalletType(null)
        localStorage.removeItem('og_wallet_address')
      }
    }
    eth.on?.('accountsChanged', onAccountsChanged)
    return () => eth.removeListener?.('accountsChanged', onAccountsChanged)
  }, [])

  const connect = async () => {
    const eth = getEthereum()
    if (!eth) {
      alert('MetaMask not found. Please install MetaMask to use the 0G arena.')
      return
    }
    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' })
      await ensureOgNetwork(eth)
      if (accounts.length > 0) {
        setActiveAddress(accounts[0])
        setWalletType(WalletType.METAMASK)
        localStorage.setItem('og_wallet_address', accounts[0])
      }
    } catch (e) {
      console.error('MetaMask connection error:', e)
    }
  }

  const disconnect = async () => {
    setActiveAddress(null)
    setWalletType(null)
    localStorage.removeItem('og_wallet_address')
  }

  const getSigner = async (): Promise<ethers.Signer> => {
    const eth = getEthereum()
    if (!eth) throw new Error('MetaMask not found')
    await ensureOgNetwork(eth)
    const provider = new ethers.BrowserProvider(eth)
    return provider.getSigner()
  }

  const signTransaction = async (): Promise<Uint8Array[]> => {
    throw new Error('Algorand group signing has been removed. Use getSigner() with contract calls on 0G.')
  }

  return (
    <WalletContext.Provider
      value={{
        activeAddress,
        walletType,
        connect,
        disconnect,
        getSigner,
        connectPera: connect,
        connectDefly: connect,
        connectLute: connect,
        signTransaction,
      }}
    >
      <DialogProvider>{children}</DialogProvider>
    </WalletContext.Provider>
  )
}
