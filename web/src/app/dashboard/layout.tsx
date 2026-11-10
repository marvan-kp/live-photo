"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Users, ImageIcon, Heart, Cloud, HardDrive, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [eventCount, setEventCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [storageProvider, setStorageProvider] = useState("Local");

  useEffect(() => {
    Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/photos").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(([evData, phData, stData]) => {
        const events = evData.events || [];
        const photos = phData.files || [];
        setEventCount(events.length);
        setPhotoCount(photos.length);
        const likes = photos.reduce((acc: number, p: any) => acc + (p.likes || 0), 0);
        setTotalLikes(likes);
        if (stData?.config?.provider) {
          setStorageProvider(
            stData.config.provider === "supabase"
              ? "Supabase"
              : stData.config.provider === "s3_r2"
              ? "Cloudflare R2"
              : stData.config.provider === "vercel_blob"
              ? "Vercel Blob"
              : stData.cloudDbHealth?.isPersistent
              ? "Cloud Sync"
              : "Local"
          );
        }
      })
      .catch((e) => console.error(e));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  const dynamicStats = [
    { label: "Active Events", value: eventCount.toString(), icon: ImageIcon },
    { label: "Cloud Photos", value: photoCount.toString(), icon: HardDrive },
    { label: "Guest Likes", value: totalLikes.toString(), icon: Heart },
    { label: "Storage Engine", value: storageProvider, icon: Cloud },
    { label: "AI Neural Face", value: "Active", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-midnight text-foreground flex">
      <DashboardSidebar />
      <main className="flex-1 ml-72 p-8 space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Operations</h1>
            <p className="text-xs text-white/50 mt-0.5">Signature by Marvan · Event & Storage Control</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-card px-4 py-2 rounded-full border-white/10 text-xs">
              Logged in as <span className="text-accent font-semibold">Marvan (Admin)</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full glass-card hover:bg-red-500/10 text-white/60 hover:text-red-400 border-white/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Real Stats */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {dynamicStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <GlassCard className="p-4 space-y-1 rounded-2xl border-white/10">
                <stat.icon className="w-5 h-5 text-accent mb-1" />
                <p className="text-xs text-white/50 font-medium">{stat.label}</p>
                <p className="text-2xl font-extrabold text-white">{stat.value}</p>
              </GlassCard>
            </motion.div>
          ))}
        </section>

        <section className="glass-card p-6 md:p-8 rounded-3xl border-white/10">
          {children}
        </section>
      </main>
    </div>
  );
}
