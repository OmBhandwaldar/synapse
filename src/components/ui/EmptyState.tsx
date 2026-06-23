import React from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  actionLabel, 
  onAction,
  actionHref,
  className = "" 
}: EmptyStateProps) {
  return (
    <div className={`punk-card p-12 flex flex-col items-center justify-center text-center stripe-bg ${className}`}>
      <h3 className="text-2xl text-punkPurple font-heading tracking-widest mb-2 uppercase">{title}</h3>
      <p className="text-streetGray mb-6 max-w-md font-body">{description}</p>
      
      {actionLabel && (
        actionHref ? (
          <Button href={actionHref} variant="secondary">{actionLabel}</Button>
        ) : (
          <Button onClick={onAction} variant="secondary">{actionLabel}</Button>
        )
      )}
    </div>
  );
}
