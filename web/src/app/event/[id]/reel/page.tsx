"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReelStudio } from "@/components/reels/ReelStudio";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowLeft, Loader2, Lock } from "lucide-react";

interface EventSummary {
  id: string;
  name: string;
  pin?: string;
}

function EventReelContent() {
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      fetch(`/api/events/${encodeURIComponent(eventId)}?_t=${Date.now()}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch("/api/auth", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ authenticated: false })),
    ])
      .then(([evData, authData]) => {
        const ev = evData?.event || null;
        setEvent(ev);
        const isAdmin = Boolean(authData?.authenticated);
        if (!ev || !ev.pin || isAdmin) {
          setIsUnlocked(true);
        } else if (typeof window !== "undefined") {
          const saved = localStorage.getItem(`unlocked_pin_${ev.id}`);
          if (saved === ev.pin) setIsUnlocked(true);
        }
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event?.pin || enteredPin.trim() === event.pin.trim()) {
      if (event && typeof window !== "undefined") {
        localStorage.setItem(`unlocked_pin_${event.id}`, enteredPin.trim());
      }
      setIsUnlocked(true);
      setPinError("");
    } else {
      setPinError("Incorrect VIP PIN.");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center text-accent">
        <Loader2 className="w-8 h-8 animate-spin" />
      </main>
    );
  }

  if (event?.pin && !isUnlocked) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <GlassCard className="w-full max-w-md p-8 rounded-3xl border-accent/40 text-center space-y-5">
          <Lock className="w-10 h-10 text-accent mx-auto" />
          <div>
            <h1 className="text-xl font-bold text-white">{event.name}</h1>
            <p className="text-xs text-white/60 mt-1">Enter VIP PIN to access the 9:16 Highlights Reel Studio.</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => {
                setEnteredPin(e.target.value);
                setPinError("");
              }}
              placeholder="● ● ● ●"
              className="w-full text-center text-2xl font-mono tracking-[0.5em] text-accent bg-black/50 border border-accent/40 rounded-xl py-3 px-4 focus:outline-none focus:border-accent"
            />
            {pinError && <p className="text-xs text-red-400">{pinError}</p>}
            <GlassButton type="submit" variant="primary" className="w-full py-2.5 text-sm">
              Unlock Story Reel
            </GlassButton>
          </form>
          <Link href={`/event/${eventId}`} className="block text-xs text-white/50 hover:text-accent">
            ← Back to Event Gallery
          </Link>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <Link
          href={`/event/${eventId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-accent" /> Back to Event Gallery
        </Link>
        {event && (
          <span className="text-xs font-semibold text-accent hidden sm:inline">
            {event.name}
          </span>
        )}
      </div>

      <ReelStudio initialEventId={eventId} mode="event" />
    </main>
  );
}

export default function EventReelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-accent">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <EventReelContent />
    </Suspense>
  );
}

