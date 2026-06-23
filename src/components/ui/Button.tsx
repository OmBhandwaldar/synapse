import React from "react";
import Link from "next/link";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  href?: string;
  children: React.ReactNode;
}

export function Button({ 
  variant = "primary", 
  size = "md", 
  href, 
  className = "", 
  children, 
  ...props 
}: ButtonProps) {
  const baseClasses = "punk-btn font-heading uppercase tracking-wider inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";
  
  const variantClasses = {
    primary: "bg-violet text-white hover:bg-violetBright",
    secondary: "bg-bgCard/60 text-inkBlack hover:bg-violet/20",
    danger: "bg-punkRed text-white hover:bg-punkOrange",
    ghost: "bg-transparent border-transparent shadow-none text-streetGray hover:text-punkPink hover:border-transparent",
  };
  
  const sizeClasses = {
    sm: "px-4 py-1.5 text-xs",
    md: "px-6 py-2.5 text-sm",
    lg: "px-8 py-3 text-base",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
