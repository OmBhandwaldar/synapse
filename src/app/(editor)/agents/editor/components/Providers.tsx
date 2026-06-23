'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

// Types for our custom wallet logic
export enum WalletType {
  PERA = 'pera',
  DEFLY = 'defly',
  LUTE = 'lute'
}

interface WalletContextType {
  activeAddress: string | null
  walletType: WalletType | null
  connectPera: () => Promise<void>
  connectDefly: () => Promise<void>
  connectLute: () => Promise<void>
  disconnect: () => Promise<void>
  signTransaction: (txgroups: any[]) => Promise<Uint8Array[]>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useAlgorandWallet = () => {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useAlgorandWallet must be used within AlgorandWalletProvider')
  return context
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [activeAddress, setActiveAddress] = useState<string | null>(null)
  const [walletType, setWalletType] = useState<WalletType | null>(null)
  
  // SDK Instances
  const [peraWallet, setPeraWallet] = useState<any>(null)
  const [deflyWallet, setDeflyWallet] = useState<any>(null)
  const [luteWallet, setLuteWallet] = useState<any>(null)

  // Initialize SDKs and Reconnect on mount
  useEffect(() => {
    const initWallets = async () => {
      // Dynamic imports to prevent SSR "window is not defined" errors
      const { PeraWalletConnect } = await import('@perawallet/connect')
      const { DeflyWalletConnect } = await import('@blockshake/defly-connect')
      const LuteConnect = (await import('lute-connect')).default
      
      const p = new PeraWalletConnect({ shouldShowSignTxnToast: false })
      const d = new DeflyWalletConnect({ shouldShowSignTxnToast: false })
      const l = new LuteConnect('Cortex')
      
      setPeraWallet(p)
      setDeflyWallet(d)
      setLuteWallet(l)

      const savedType = localStorage.getItem('algorand_wallet_type') as WalletType | null
      const savedAddress = localStorage.getItem('algorand_wallet_address')

      if (!savedType || !savedAddress) return

      if (savedType === WalletType.PERA) {
        try {
          const accounts = await p.reconnectSession()
          if (accounts && accounts.length > 0) {
            setActiveAddress(accounts[0])
            setWalletType(WalletType.PERA)
            // Keep session alive: disconnect when wallet app disconnects
            p.connector?.on('disconnect', () => {
              setActiveAddress(null)
              setWalletType(null)
              localStorage.removeItem('algorand_wallet_type')
              localStorage.removeItem('algorand_wallet_address')
            })
          } else {
            // Session expired — clear stale data
            localStorage.removeItem('algorand_wallet_type')
            localStorage.removeItem('algorand_wallet_address')
          }
        } catch {
          localStorage.removeItem('algorand_wallet_type')
          localStorage.removeItem('algorand_wallet_address')
        }
      } else if (savedType === WalletType.DEFLY) {
        try {
          const accounts = await d.reconnectSession()
          if (accounts && accounts.length > 0) {
            setActiveAddress(accounts[0])
            setWalletType(WalletType.DEFLY)
            d.connector?.on('disconnect', () => {
              setActiveAddress(null)
              setWalletType(null)
              localStorage.removeItem('algorand_wallet_type')
              localStorage.removeItem('algorand_wallet_address')
            })
          } else {
            localStorage.removeItem('algorand_wallet_type')
            localStorage.removeItem('algorand_wallet_address')
          }
        } catch {
          localStorage.removeItem('algorand_wallet_type')
          localStorage.removeItem('algorand_wallet_address')
        }
      } else if (savedType === WalletType.LUTE) {
        // Lute does not require async reconnect — restore the address directly from storage
        setActiveAddress(savedAddress)
        setWalletType(WalletType.LUTE)
      }
    }

    initWallets()
  }, [])


  const connectPera = async () => {
    if (!peraWallet) return
    try {
      const accounts = await peraWallet.connect()
      if (accounts.length > 0) {
        const addr = accounts[0]
        setActiveAddress(addr)
        setWalletType(WalletType.PERA)
        localStorage.setItem('algorand_wallet_type', WalletType.PERA)
        localStorage.setItem('algorand_wallet_address', addr)
      }
    } catch (e) {
      console.error('Pera connection error:', e)
    }
  }

  const connectDefly = async () => {
    if (!deflyWallet) return
    try {
      const accounts = await deflyWallet.connect()
      if (accounts.length > 0) {
        const addr = accounts[0]
        setActiveAddress(addr)
        setWalletType(WalletType.DEFLY)
        localStorage.setItem('algorand_wallet_type', WalletType.DEFLY)
        localStorage.setItem('algorand_wallet_address', addr)
      }
    } catch (e) {
      console.error('Defly connection error:', e)
    }
  }

  const connectLute = async () => {
    if (!luteWallet) return
    try {
      const accounts = await luteWallet.connect('testnet-v1.0')
      if (accounts.length > 0) {
        const addr = accounts[0]
        setActiveAddress(addr)
        setWalletType(WalletType.LUTE)
        localStorage.setItem('algorand_wallet_type', WalletType.LUTE)
        localStorage.setItem('algorand_wallet_address', addr)
      }
    } catch (e) {
      console.error('Lute connection error:', e)
    }
  }

  const disconnect = async () => {
    if (walletType === WalletType.PERA && peraWallet) await peraWallet.disconnect()
    if (walletType === WalletType.DEFLY && deflyWallet) await deflyWallet.disconnect()
    
    setActiveAddress(null)
    setWalletType(null)
    localStorage.removeItem('algorand_wallet_type')
    localStorage.removeItem('algorand_wallet_address')
  }

  const signTransaction = async (txgroups: any[]): Promise<Uint8Array[]> => {
    if (!walletType) throw new Error('No wallet connected')
    if (walletType === WalletType.PERA && peraWallet) {
      return await peraWallet.signTransaction(txgroups)
    }
    if (walletType === WalletType.DEFLY && deflyWallet) {
      return await deflyWallet.signTransaction(txgroups)
    }
    if (walletType === WalletType.LUTE && luteWallet) {
      const algosdk = await import('algosdk');
      const formatForLute = txgroups.flat().map(t => {
        return {
          txn: Buffer.from(algosdk.encodeUnsignedTransaction(t.txn)).toString('base64')
        };
      });
      return await luteWallet.signTxns(formatForLute);
    }
    throw new Error('Wallet not initialized properly')
  }

  return (
    <WalletContext.Provider value={{ activeAddress, walletType, connectPera, connectDefly, connectLute, disconnect, signTransaction }}>
      {children}
    </WalletContext.Provider>
  )
}
