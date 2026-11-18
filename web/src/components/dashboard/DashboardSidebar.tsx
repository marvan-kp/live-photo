"use client";

import Link from "next/link";
import { Camera, LayoutDashboard, Image as ImageIcon, Users, Settings, LogOut, QrCode, ScanEye } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: ImageIcon, label: "Events", href: "/dashboard/events" },
  { icon: Camera, label: "Live Tether", href: "/dashboard/tether" },
  { icon: ScanEye, label: "AI Culling", href: "/dashboard/culling" },
  { icon: Users, label: "Guests", href: "/dashboard/guests" },
  { icon: QrCode, label: "QR Manager", href: "/dashboard/qr" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export const DashboardSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      router.push("/login");
    } catch (_) {}
  };

  return (
    <aside className="fixed left-6 top-6 bottom-6 w-64 glass-card rounded-3xl p-6 flex flex-col z-40 border-white/10 shadow-2xl">
      <Link href="/" className="flex flex-col gap-2 font-bold text-xl tracking-tight mb-8 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Signature by Marvan"
          className="h-10 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(212,183,122,0.3)] self-start"
        />
        <span className="text-gradient text-sm font-semibold tracking-wide">Signature by Marvan</span>
      </Link>

      <nav className="flex-1 space-y-2">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                isActive
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-accent" : "group-hover:scale-110 transition-transform")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:text-red-400 hover:bg-red-400/5 transition-all mt-auto cursor-pointer"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Logout</span>
      </button>
    </aside>
  );
};
