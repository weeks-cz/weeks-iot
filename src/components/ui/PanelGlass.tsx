import type { HTMLAttributes, ReactNode } from "react";

interface PanelGlassProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "stat";
}

export function PanelGlass({ className = "", children, variant = "default", ...rest }: PanelGlassProps) {
  const padding = variant === "stat" ? "p-4" : "p-6";
  return (
    <div className={`panel-glass ${padding} ${className}`} {...rest}>
      {children}
    </div>
  );
}
