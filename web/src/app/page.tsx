"use client";

import { useEffect, useState } from "react";
import { GlassNavbar } from "@/components/ui/GlassNavbar";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { motion } from "framer-motion";
import {
  QrCode,
  Sparkles,
  Zap,
  ArrowRight,
  Download,
  Calendar,
  MapPin,
  Camera,
  Tv,
  X,
  Share2,
  Lock
} from "lucide-react";
import Link from "next/link";
import { generateQRCodeDataUrl } from "@/lib/qrcode";
import { getPublicBaseUrl } from "@/lib/publicUrl";

interface EventItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  date: string;
  location: string;
  coverUrl: string;
  photosCount: number;
  guestsCount: number;
  status: string;
}

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedQrEvent, setSelectedQrEvent] = useState<EventItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoadingEvents(false));
  }, []);

  const handleOpenQrModal = async (event: EventItem) => {
    setSelectedQrEvent(event);
    const url = `${getPublicBaseUrl()}/event/${event.id}`;
    const qr = await generateQRCodeDataUrl(url, { width: 300, margin: 2 });
    setQrDataUrl(qr);
  };

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden pb-24">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[160px] pointer-events-none" />

      <GlassNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 max-w-4xl flex flex-col items-center"
        >
          {/* Brand Logo */}
          <div className="flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Signature by Marvan"
              className="h-24 md:h-32 w-auto object-contain filter drop-shadow-[0_4px_24px_rgba(212,183,122,0.45)]"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-xs font-semibold tracking-wide text-accent uppercase">
            <Sparkles className="w-4 h-4" /> Signature by Marvan · Live QR & AI Photo Sharing
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Every Moment. <br />
            <span className="text-gradient">Every Guest. Every Memory.</span>
          </h1>

          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto font-light">
            Luxury real-time photography platform powered by local deep neural AI face recognition.
            Guests scan a QR code or snap a selfie to instantly find and download their photos in full resolution.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a href="#live-events">
              <GlassButton variant="primary" className="flex items-center gap-2 px-6 py-3 font-semibold text-sm">
                Explore Live Events <ArrowRight className="w-4 h-4" />
              </GlassButton>
            </a>
            <Link href="/ai-search">
              <GlassButton variant="secondary" className="flex items-center gap-2 px-6 py-3 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-accent" /> AI Face Search
              </GlassButton>
            </Link>
            <Link href="/download">
              <GlassButton variant="secondary" className="flex items-center gap-2 px-6 py-3 font-semibold text-sm border-accent/30 text-accent">
                <Download className="w-4 h-4" /> Android App
              </GlassButton>
            </Link>
            <Link href="/login">
              <GlassButton variant="secondary" className="flex items-center gap-2 px-5 py-3 font-semibold text-sm text-white/70">
                <Lock className="w-4 h-4" /> Admin Portal
              </GlassButton>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Live Events Section & Sliding Cards */}
      <section className="py-12 px-6 max-w-7xl mx-auto" id="live-events">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Now
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Active Event Galleries</h2>
            <p className="text-sm text-white/60 mt-1">
              Tap any event card to open its live photo stream, view TV slideshow, or scan the QR code.
            </p>
          </div>

          <Link href="/dashboard/events">
            <GlassButton variant="secondary" className="text-xs px-4 py-2 flex items-center gap-1.5 font-semibold">
              + Host New Event
            </GlassButton>
          </Link>
        </div>

        {loadingEvents ? (
          <div className="py-16 text-center text-white/50 text-sm">Loading active events...</div>
        ) : events.length === 0 ? (
          <GlassCard className="p-12 text-center space-y-4 rounded-3xl border-white/10 max-w-lg mx-auto">
            <Camera className="w-12 h-12 text-accent mx-auto" />
            <h3 className="text-xl font-bold text-white">No Live Events Right Now</h3>
            <p className="text-xs text-white/50">
              Create your first live photography event and share photos instantly with your guests!
            </p>
            <Link href="/dashboard/events">
              <GlassButton variant="primary" className="mx-auto text-xs px-5 py-2.5">
                Create First Event
              </GlassButton>
            </Link>
          </GlassCard>
        ) : (
          /* Horizontal Slider / Grid of Live Event Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((ev, i) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard className="rounded-3xl overflow-hidden border-white/15 hover:border-accent/40 transition-all flex flex-col justify-between group shadow-xl">
                  {/* Card Cover Area */}
                  <div className="relative aspect-[16/10] bg-black/60 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ev.coverUrl || "/logo.png"}
                      alt={ev.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight via-black/30 to-transparent" />

                    {/* Status & Code Pills */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                      </span>

                      <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-accent/40 text-accent text-xs font-mono font-bold tracking-wider shadow-lg">
                        CODE: {ev.code}
                      </span>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                        {ev.photosCount} Photos Uploaded Live
                      </span>
                      <h3 className="text-xl font-bold text-white line-clamp-1">{ev.name}</h3>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-5 space-y-4">
                    <div className="space-y-1.5 text-xs text-white/60">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        <span>{ev.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                      <Link href={`/event/${ev.id}`} className="flex-1">
                        <GlassButton variant="primary" className="w-full text-xs py-2.5 font-bold flex items-center justify-center gap-1.5">
                          Open Gallery <ArrowRight className="w-3.5 h-3.5" />
                        </GlassButton>
                      </Link>

                      <Link href={`/event/${ev.id}/live`}>
                        <GlassButton variant="secondary" className="text-xs px-3 py-2.5" title="Live TV Slideshow">
                          <Tv className="w-4 h-4 text-accent" />
                        </GlassButton>
                      </Link>

                      <button
                        onClick={() => handleOpenQrModal(ev)}
                        className="p-2.5 rounded-xl glass-card hover:bg-white/10 text-white/70 hover:text-white border-white/10 transition-colors"
                        title="Display QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto" id="features">
        <div className="text-center space-y-4 mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">Engineered for Luxury Events</h2>
          <p className="text-white/60 max-w-xl mx-auto text-sm">
            Everything your photography team and guests need for real-time engagement with zero friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard className="p-6 space-y-3 rounded-3xl border-white/10">
            <div className="p-3 bg-accent/10 rounded-2xl w-fit text-accent">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">AI Neural Face Matching</h3>
            <p className="text-white/60 text-xs leading-relaxed">
              Guests take a quick selfie to find all photos featuring them across thousands of gallery shots in under 150ms. 100% free with local neural models.
            </p>
          </GlassCard>

          <GlassCard className="p-6 space-y-3 rounded-3xl border-white/10">
            <div className="p-3 bg-blue-500/10 rounded-2xl w-fit text-blue-400">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Instant Table QR Access</h3>
            <p className="text-white/60 text-sm">
              Guests scan customized QR table tent cards or screen codes to enter the event gallery and upload photos without installing anything.
            </p>
          </GlassCard>

          <GlassCard className="p-6 space-y-3 rounded-3xl border-white/10">
            <div className="p-3 bg-emerald-500/10 rounded-2xl w-fit text-emerald-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Live Multi-Screen Projection</h3>
            <p className="text-white/60 text-xs leading-relaxed">
              Broadcast live slideshows to ballroom projectors and TV screens. New guest uploads appear live on stage with animated transitions.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* QR Code Quick Modal */}
      {selectedQrEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-8 rounded-3xl border-white/20 text-center space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedQrEvent(null)}
              className="absolute top-5 right-5 text-white/50 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            <div>
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Event QR Scanner</span>
              <h3 className="text-2xl font-extrabold text-white mt-1">{selectedQrEvent.name}</h3>
              <p className="text-xs text-white/50 mt-1">Scan with any smartphone camera to open gallery & upload live</p>
            </div>

            {/* QR Image Box */}
            <div className="p-6 bg-white rounded-2xl inline-block mx-auto shadow-2xl">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
              )}
            </div>

            <p className="text-[11px] text-accent/80 font-mono text-center break-all select-all px-2">
              {`${getPublicBaseUrl()}/event/${selectedQrEvent.id}`}
            </p>

            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
              <span className="text-white/60">Event Access Code:</span>
              <span className="font-mono font-bold text-accent text-sm">{selectedQrEvent.code}</span>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/event/${selectedQrEvent.id}`} className="flex-1">
                <GlassButton variant="primary" className="w-full text-xs py-3 font-bold">
                  Open Guest Gallery
                </GlassButton>
              </Link>
              <a href={qrDataUrl} download={`qr_${selectedQrEvent.code}.png`}>
                <GlassButton variant="secondary" className="text-xs px-4 py-3">
                  <Download className="w-4 h-4" />
                </GlassButton>
              </a>
            </div>
          </GlassCard>
        </div>
      )}
    </main>
  );
}
