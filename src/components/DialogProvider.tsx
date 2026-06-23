'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogContextType {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<{
    type: 'alert' | 'confirm' | 'prompt';
    message: string;
    defaultValue?: string;
    resolve: (val: any) => void;
  } | null>(null);

  const [promptValue, setPromptValue] = useState('');

  const alert = (message: string) => {
    return new Promise<void>((resolve) => {
      setActive({ type: 'alert', message, resolve });
    });
  };

  const confirm = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setActive({ type: 'confirm', message, resolve });
    });
  };

  const prompt = (message: string, defaultValue = '') => {
    setPromptValue(defaultValue);
    return new Promise<string | null>((resolve) => {
      setActive({ type: 'prompt', message, defaultValue, resolve });
    });
  };

  const handleClose = (value: any) => {
    if (active) {
      active.resolve(value);
      setActive(null);
    }
  };

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {active && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="punk-card w-full max-w-sm bg-bgCream p-6 border-3 border-inkBlack shadow-2xl relative animate-in zoom-in-95 duration-150 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg text-inkBlack tracking-wider uppercase mb-2">
              {active.type === 'confirm' ? 'Confirm Action ⚔️' : active.type === 'prompt' ? 'Input Required ✏️' : 'Notification 📢'}
            </h3>
            <div className="punk-divider mb-4" />
            <p className="font-body text-inkBlack text-sm mb-4 leading-relaxed whitespace-pre-wrap">
              {active.message}
            </p>
            
            {active.type === 'prompt' && (
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="w-full border-2 border-inkBlack bg-white p-2 text-sm text-inkBlack focus:outline-none focus:border-punkPink rounded mb-5 font-mono"
                placeholder="Enter value..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleClose(promptValue);
                  if (e.key === 'Escape') handleClose(null);
                }}
              />
            )}

            <div className="flex justify-end gap-3">
              {(active.type === 'confirm' || active.type === 'prompt') && (
                <button
                  onClick={() => handleClose(active.type === 'confirm' ? false : null)}
                  className="punk-btn bg-white hover:bg-streetGray/10 text-inkBlack px-4 py-2 font-heading text-xs uppercase"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => handleClose(active.type === 'prompt' ? promptValue : true)}
                className="punk-btn bg-punkYellow text-inkBlack px-5 py-2 font-heading text-xs uppercase"
              >
                {active.type === 'confirm' ? 'Confirm' : active.type === 'prompt' ? 'Submit' : 'OK'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </DialogContext.Provider>
  );
}
