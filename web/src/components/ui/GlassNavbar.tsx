"use client";

import Link from "next/link";
import { GlassButton } from "./GlassButton";
import { Camera } from "lucide-react";

export const GlassNavbar = () => {
  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-5xl">
      <div className="glass-nav rounded-full px-6 py-4 flex items-center justify-between border border-white/10 shadow-2xl">
        <Link href="/" className="flex items-center gap-3 font-bold text-xl tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Signature by Marvan"
            className="h-9 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(212,183,122,0.3)]"
          />
          <span className="text-gradient hidden sm:inline text-lg">Signature by Marvan</span>
        </Link>

        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-white/70">
          <Link href="/#live-events" className="hover:text-white transition-colors">Live Events</Link>
          <Link href="/ai-search" className="hover:text-accent transition-colors">AI Face Search</Link>
          <Link href="/download" className="hover:text-accent transition-colors">Android App</Link>
          <Link href="/login" className="hover:text-white transition-colors">Admin Portal</Link>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <GlassButton variant="secondary" className="text-xs px-3.5 py-1.5 font-semibold">
              Admin
            </GlassButton>
          </Link>
          <Link href="/download">
            <GlassButton variant="primary" className="text-xs px-4 py-1.5 font-semibold">
              Get APK
            </GlassButton>
          </Link>
        </div>
      </div>
    </nav>
  );
};
