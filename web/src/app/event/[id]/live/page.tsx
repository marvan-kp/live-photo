"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import { generateQRCodeDataUrl } from "@/lib/qrcode";
import { getPublicBaseUrl } from "@/lib/publicUrl";
import { Loader2, Maximize, Minimize, QrCode, Sparkles, ArrowLeft, Download, Play, Pause, Heart } from "lucide-react";
import Link from "next/link";

interface EventData {
  id: string;
  name: string;
  code: string;
  location?: string;
  date?: string;
}

interface PhotoData {
  id: string;
  name: string;
  url: string;
  guestName?: string;
  caption?: string;
  likes?: number;
  createdAt: string;
}

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number; // percentage across screen
  size: number;
  color: string;
}

function LiveSlideshowContent() {
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const lastLikesRef = useRef<Record<string, number>>({});

  // Fetch event and photos
  const fetchData = async () => {
    if (!eventId) return;
    try {
      const timestamp = Date.now();
      const [resEvent, resPhotos] = await Promise.all([
        fetch(`/api/events/${eventId}?_t=${timestamp}`, { cache: "no-store" }),
        fetch(`/api/photos?eventId=${eventId}&_t=${timestamp}`, { cache: "no-store" })
      ]);
      if (resEvent.ok) {
        const ev = await resEvent.json();
        setEvent(ev.event);
      }
      if (resPhotos.ok) {
        const ph = await resPhotos.json();
        const incoming: PhotoData[] = ph.files || [];
        setPhotos((prev) => {
          if (!prev || prev.length === 0) return incoming;
          const map = new Map<string, PhotoData>();
          incoming.forEach((p) => map.set(p.id, p));
          prev.forEach((p) => {
            if (!map.has(p.id)) {
              map.set(p.id, p);
            } else {
              const cur = map.get(p.id)!;
              if ((p.likes || 0) > (cur.likes || 0)) {
                map.set(p.id, { ...cur, likes: p.likes });
              }
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

        // Detect new likes and trigger celebration hearts!
        let hasNewLike = false;
        incoming.forEach((p) => {
          const oldLikes = lastLikesRef.current[p.id] ?? p.likes ?? 0;
          if ((p.likes || 0) > oldLikes) {
            hasNewLike = true;
          }
          lastLikesRef.current[p.id] = p.likes || 0;
        });

        if (hasNewLike) {
          triggerLiveReactions(5);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const triggerLiveReactions = (count = 3) => {
    const emojis = ["❤️", "✨", "🔥", "💖", "🥂", "💍"];
    const newItems: FloatingReaction[] = Array.from({ length: count }).map(() => ({
      id: Date.now() + Math.random(),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      x: 10 + Math.random() * 80,
      size: 20 + Math.random() * 24,
      color: "#e2b866"
    }));

    setReactions((prev) => [...prev, ...newItems]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => !newItems.includes(r)));
    }, 3500);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);
    return () => clearInterval(interval);
  }, [eventId]);

  // Generate QR code using reachable public URL
  useEffect(() => {
    if (eventId) {
      const base = typeof window !== "undefined" ? getPublicBaseUrl() : "";
      const uploadUrl = `${base}/event/${eventId}`;
      generateQRCodeDataUrl(uploadUrl, { width: 300, margin: 2 }).then(setQrDataUrl);
    }
  }, [eventId]);

  // Auto-rotate slideshow every 6.5 seconds when not paused
  useEffect(() => {
    if (photos.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [photos.length, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % Math.max(1, photos.length));
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % Math.max(1, photos.length));
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-[#d4af37]" />
        <p className="text-white/60 tracking-widest uppercase text-xs">Loading Live Stage Wall...</p>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="relative w-screen h-screen bg-[#07090e] text-white overflow-hidden select-none font-sans">
      {/* Background ambient lighting with Ken Burns zoom */}
      {currentPhoto && (
        <div
          key={`ambient-${currentPhoto.id}`}
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-35 scale-125 transition-all duration-1000 ease-out"
          style={{ backgroundImage: `url(${currentPhoto.url})` }}
        />
      )}

      {/* Floating Live Reactions (Hearts / Confetti on Likes) */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-10 animate-floatUp"
            style={{
              left: `${r.x}%`,
              fontSize: `${r.size}px`,
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Glass Header */}
      <div className="absolute top-6 left-6 right-6 z-30 flex justify-between items-center bg-black/60 backdrop-blur-xl px-6 py-3.5 rounded-full border border-white/10 shadow-2xl">
        <Link
          href={`/event/${eventId}`}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-xs uppercase tracking-wider font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Gallery
        </Link>

        {/* Center Studio Signature Branding */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 absolute" />
            <span className="text-xs uppercase font-extrabold tracking-widest text-red-400 ml-1">STAGE LIVE</span>
          </div>
          <span className="text-white/20">|</span>
          <h1 className="font-serif italic font-bold text-base md:text-lg tracking-wide text-[#e5c07b]">
            Signature by Marvan
          </h1>
          <span className="hidden md:inline text-xs text-white/50">• {event?.name}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Pause / Resume button */}
          <button
            onClick={() => setIsPaused((p) => !p)}
            title={isPaused ? "Resume Slideshow" : "Pause Slideshow"}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
          >
            {isPaused ? <Play className="w-4 h-4 text-[#e5c07b]" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Master ZIP Download button */}
          <a
            href={`/api/events/${eventId}/download`}
            download
            title="Download All Photos (.ZIP)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#d4af37]/30 to-[#f3e5ab]/20 hover:from-[#d4af37]/50 hover:to-[#f3e5ab]/40 border border-[#d4af37]/40 text-xs font-semibold text-[#f5d77f] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Master ZIP</span>
          </a>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Slideshow Stage with Ken Burns Slow Motion */}
      <div className="relative w-full h-full flex items-center justify-center p-6 md:p-14">
        {photos.length === 0 ? (
          <div className="text-center space-y-4 max-w-md p-10 rounded-3xl bg-black/60 border border-white/15 backdrop-blur-2xl shadow-2xl">
            <QrCode className="w-16 h-16 text-[#e5c07b] mx-auto animate-pulse" />
            <h2 className="text-2xl font-bold tracking-tight">Stage Screen Active</h2>
            <p className="text-white/60 text-sm">
              Scan the QR code below on your phone to beam your photos directly onto this venue screen!
            </p>
          </div>
        ) : (
          <div className="relative max-w-full max-h-[85vh] flex flex-col items-center group">
            {/* Stage Photo with smooth Ken Burns Motion */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] max-h-[78vh]">
              <img
                key={currentPhoto.id}
                src={currentPhoto.url}
                alt={currentPhoto.name}
                className="max-h-[78vh] w-auto max-w-full object-contain transform transition-transform duration-[6500ms] ease-out scale-100 hover:scale-105"
              />

              {/* Studio Luxury Watermark in bottom corner */}
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 opacity-80">
                <Sparkles className="w-3 h-3 text-[#e5c07b]" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#f5d77f]">
                  Signature by Marvan
                </span>
              </div>
            </div>

            {/* Stage Caption Banner */}
            <div className="mt-4 w-full max-w-3xl bg-black/75 backdrop-blur-xl px-6 py-3.5 rounded-2xl border border-white/15 flex justify-between items-center shadow-xl">
              <div className="flex items-center gap-3 truncate">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#d4af37] to-[#aa771c] flex items-center justify-center font-bold text-xs text-black uppercase shadow-md">
                  {(currentPhoto.guestName || "G")[0]}
                </div>
                <div className="truncate">
                  <p className="font-bold text-base text-white tracking-wide truncate">
                    {currentPhoto.guestName || "Guest Photo"}
                  </p>
                  {currentPhoto.caption && (
                    <p className="text-xs text-white/80 italic truncate">{currentPhoto.caption}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 pl-4 shrink-0">
                {(currentPhoto.likes || 0) > 0 && (
                  <div className="flex items-center gap-1 text-red-400 font-bold text-sm bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                    <Heart className="w-4 h-4 fill-red-500 text-red-500 animate-pulse" />
                    <span>{currentPhoto.likes}</span>
                  </div>
                )}
                <span className="text-xs text-white/40 font-mono">
                  {currentIndex + 1} / {photos.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Luxury QR Stage Card in bottom right */}
      <div className="absolute bottom-8 right-8 z-30 bg-black/85 backdrop-blur-2xl p-4 rounded-3xl border border-[#d4af37]/30 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center gap-4 hover:scale-105 transition-transform duration-300">
        <div className="p-2 bg-white rounded-2xl shadow-inner">
          {qrDataUrl && <img src={qrDataUrl} alt="Scan QR" className="w-24 h-24 object-contain" />}
        </div>
        <div className="text-left pr-2">
          <p className="text-[10px] uppercase tracking-widest text-[#e5c07b] font-extrabold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Scan & Share
          </p>
          <p className="text-sm font-extrabold text-white mt-0.5">Add Your Photo</p>
          <p className="text-xs text-white/60">Beams to this screen live</p>
          {event?.code && (
            <p className="text-[11px] font-mono font-bold text-[#f5d77f] mt-1 bg-white/10 px-2 py-0.5 rounded-full inline-block">
              Code: {event.code}
            </p>
          )}
        </div>
      </div>

      {/* Custom CSS for floating celebration reactions */}
      <style jsx global>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(0.8);
          }
          50% {
            opacity: 0.9;
            transform: translateY(-160px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-340px) scale(1.4);
          }
        }
        .animate-floatUp {
          animation: floatUp 3.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default function LiveSlideshowPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
          <Loader2 className="w-10 h-10 animate-spin text-[#d4af37]" />
        </div>
      }
    >
      <LiveSlideshowContent />
    </Suspense>
  );
}
