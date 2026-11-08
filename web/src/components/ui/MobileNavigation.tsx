import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Camera, Image as ImageIcon, RotateCcw } from "lucide-react";
import { useState } from "react";

export default function MobileNavigation() {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 md:hidden">
      <div className="glass-nav rounded-full px-6 py-4 flex items-center justify-between border border-white/10 shadow-2xl">
        <a href="/" className="text-white/70 hover:text-white">Home</a>
        <a href="/dashboard" className="text-white/70 hover:text-white">Events</a>
        <a href="/upload" className="p-3 rounded-full bg-accent text-midnight">
          <Camera className="w-6 h-6" />
        </a>
        <a href="/galleries" className="text-white/70 hover:text-white">Gallery</a>
        <a href="/profile" className="text-white/70 hover:text-white">Profile</a>
      </div>
    </div>
  );
}
