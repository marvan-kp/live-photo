"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassNavbar } from "@/components/ui/GlassNavbar";
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle, Loader2, LogOut } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("marvan2026");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        router.push("/dashboard");
      } else {
        setError(data.error || "Invalid username or password");
      }
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setIsAuthenticated(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col justify-center items-center px-4 py-16">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-blue-500/10 rounded-full blur-[150px] pointer-events-none" />

      <GlassNavbar />

      <div className="w-full max-w-md pt-20">
        <GlassCard className="p-8 rounded-3xl border-white/15 shadow-2xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-3 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Signature by Marvan"
              className="h-16 w-auto object-contain filter drop-shadow-[0_4px_16px_rgba(212,183,122,0.4)]"
            />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Organizer & Admin Portal
            </div>
            <h1 className="text-2xl font-extrabold text-white">Admin Login</h1>
            <p className="text-xs text-white/50">
              Sign in to manage live events, configure cloud storage, and oversee live streams.
            </p>
          </div>

          {checkingAuth ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-4 text-center py-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                You are currently logged in as <strong>Admin</strong>.
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/dashboard">
                  <GlassButton variant="primary" className="w-full flex items-center justify-center gap-2">
                    Open Dashboard <ArrowRight className="w-4 h-4" />
                  </GlassButton>
                </Link>
                <GlassButton variant="secondary" onClick={handleLogout} className="w-full flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4 text-red-400" /> Sign Out
                </GlassButton>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">
                  Admin Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-accent"
                    required
                  />
                  <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-accent"
                    required
                  />
                  <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {/* Quick Preset Helper */}
              <div
                onClick={() => {
                  setUsername("admin");
                  setPassword("marvan2026");
                }}
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-accent/30 cursor-pointer flex items-center justify-between text-xs text-white/50 transition-colors"
              >
                <span>Default credentials:</span>
                <span className="font-mono text-accent">admin / marvan2026</span>
              </div>

              <GlassButton
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full py-3 text-sm font-bold flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    Sign In to Dashboard <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </GlassButton>
            </form>
          )}
        </GlassCard>
      </div>
    </main>
  );
}

