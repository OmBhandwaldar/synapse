"use client";

import React from 'react';

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
  accentColor?: "pink" | "purple" | "green" | "blue" | "orange";
}

const ACCENT_BORDERS: Record<string, string> = {
  pink: "hover:border-punkPink",
  purple: "hover:border-punkPurple",
  green: "hover:border-punkGreen",
  blue: "hover:border-punkBlue",
  orange: "hover:border-punkOrange",
};

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  accentColor = 'pink',
}) => {
  const hoverBorder = ACCENT_BORDERS[accentColor] || ACCENT_BORDERS.pink;

  return (
    <div
      className={`punk-card ${hoverBorder} transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
};

export default SpotlightCard;
