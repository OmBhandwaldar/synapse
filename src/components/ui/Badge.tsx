import React from "react";

export interface BadgeProps {
  label: string;
  color?: "pink" | "purple" | "green" | "blue" | "orange" | "red" | "yellow" | "dark" | "gray";
  className?: string;
}

export function Badge({ label, color = "dark", className = "" }: BadgeProps) {
  const colorMap: Record<string, string> = {
    pink: "sticker-pink",
    purple: "sticker-purple",
    green: "sticker-green",
    blue: "sticker-blue",
    orange: "sticker-orange",
    red: "sticker-red",
    yellow: "sticker-yellow",
    dark: "sticker-dark",
    gray: "sticker-dark",
  };

  return (
    <span className={`sticker ${colorMap[color]} ${className}`}>
      {label}
    </span>
  );
}
