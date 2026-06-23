import React from "react";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  jpTitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, jpTitle, action }: SectionHeaderProps) {
  return (
    <header className="pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 relative">
      {/* Rainbow divider */}
      <div className="absolute bottom-0 left-0 right-0 punk-divider" />
      
      <div>
        <div className="flex items-baseline gap-4">
          <h1 className="text-5xl md:text-7xl text-inkBlack uppercase">{title}</h1>
          {jpTitle && (
            <span className="font-jp text-2xl md:text-3xl text-punkPink opacity-50 font-bold">
              {jpTitle}
            </span>
          )}
        </div>
        {subtitle && <p className="text-streetGray mt-2 max-w-2xl font-body text-lg">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
