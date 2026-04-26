import type { HTMLAttributes, ReactNode } from "react";

interface PanelGlassProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function PanelGlass({ className = "", children, ...rest }: PanelGlassProps) {
  return (
    <div className={`panel-glass p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}
