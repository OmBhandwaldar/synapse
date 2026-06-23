import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "highlight" | "danger";
  accentColor?: "pink" | "purple" | "green" | "blue" | "orange";
  children: React.ReactNode;
}

export function Card({ variant = "default", accentColor, className = "", children, ...props }: CardProps) {
  const accentMap: Record<string, string> = {
    pink: "punk-card-pink",
    purple: "punk-card-purple",
    green: "punk-card-green",
    blue: "punk-card-blue",
    orange: "",
  };

  const variantClasses = {
    default: "",
    highlight: "border-l-[6px] border-l-punkPink",
    danger: "border-l-[6px] border-l-punkRed",
  };

  const accent = accentColor ? accentMap[accentColor] : "";

  return (
    <div 
      className={`punk-card ${accent} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
