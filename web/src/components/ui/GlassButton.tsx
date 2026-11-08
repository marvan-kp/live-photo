"use client"
import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "framer-motion";

interface GlassButtonProps extends Omit<React.ComponentProps<typeof motion.button>, "variant"> {
  variant?: "primary" | "secondary" | "ghost";
}

export const GlassButton = ({
  className,
  variant = "primary",
  children,
  ...props
}: GlassButtonProps) => {
  const variants = {
    primary: "bg-accent text-midnight hover:bg-accent/90",
    secondary: "bg-white/10 text-white hover:bg-white/20",
    ghost: "bg-transparent text-white hover:bg-white/5",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "px-6 py-3 rounded-full font-medium transition-all duration-300 border border-white/10 backdrop-blur-md",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};
