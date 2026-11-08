import { cn } from "@/lib/utils";
import React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "light" | "medium" | "deep";
}

export const GlassCard = ({
  className,
  intensity = "medium",
  children,
  ...props
}: GlassCardProps) => {
  const intensityClasses = {
    light: "bg-white/5",
    medium: "bg-white/10",
    deep: "bg-black/20",
  };

  return (
    <div
      className={cn(
        "glass-card rounded-2xl p-6 transition-all duration-300 hover:border-white/30",
        intensityClasses[intensity],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
