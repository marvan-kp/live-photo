"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { generateQRCodeDataUrl } from "@/lib/qrcode";
import { Loader2, Maximize, Minimize, QrCode, Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface EventData {
  id: string;
  name: string;
  code: string;
}

interface PhotoData {
  id: string;
  name: string;
  url: string;
  guestName?: string;
  caption?: string;
  createdAt: string;
}

function LiveSlideshowContent() {
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch event and photos
  const fetchData = async () => {
    if (!eventId) return;
    try {
      const [resEvent, resPhotos] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/photos?eventId=${eventId}`)
      ]);
      if (resEvent.ok) {
        const ev = await resEvent.json();
        setEvent(ev.event);
      }
      if (resPhotos.ok) {
        const ph = await resPhotos.json();
        setPhotos(ph.files || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [eventId]);

  // Generate QR code for the guest upload URL
  useEffect(() => {
    if (typeof window !== "undefined" && eventId) {
      const uploadUrl = `${window.location.origin}/event/${eventId}`;
      generateQRCodeDataUrl(uploadUrl, { width: 300, margin: 2 }).then(setQrDataUrl);
    }
  }, [eventId]);

  // Rotate slideshow every 6 seconds
  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [photos.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden select-none">
      {/* Background ambient blur */}
      {currentPhoto && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-30 scale-110 transition-all duration-1000"
          style={{ backgroundImage: `url(${currentPhoto.url})` }}
        />
      )}

      {/* Top Bar Controls */}
      <div className="absolute top-6 left-6 right-6 z-30 flex justify-between items-center bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
        <Link href={`/event/${eventId}`} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Event
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent animate-pulse" />
          <span className="font-bold text-sm tracking-wide text-white">{event?.name || "Live Stream"}</span>
          <span className="text-xs bg-red-500/80 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse ml-2">
            LIVE
          </span>
        </div>
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Slideshow Image */}
      <div className="relative w-full h-full flex items-center justify-center p-8 md:p-16">
        {photos.length === 0 ? (
          <div className="text-center space-y-4 max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <QrCode className="w-16 h-16 text-accent mx-auto" />
            <h2 className="text-2xl font-bold">Waiting for First Photo!</h2>
            <p className="text-white/60 text-sm">Scan the QR code below on your phone to upload photos to this screen!</p>
          </div>
        ) : (
          <div className="relative max-w-full max-h-[85vh] flex flex-col items-center">
            <img
              src={currentPhoto.url}
              alt={currentPhoto.name}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-3xl shadow-2xl transition-all duration-700 animate-fadeIn"
            />
            {/* Caption & Guest Tag */}
            <div className="absolute bottom-6 left-6 right-6 md:left-12 md:right-12 bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex justify-between items-center">
              <div>
                <p className="font-bold text-lg text-white">{currentPhoto.guestName || "Guest"}</p>
                {currentPhoto.caption && <p className="text-sm text-white/80">{currentPhoto.caption}</p>}
              </div>
              <span className="text-xs text-white/40 font-mono">
                {currentIndex + 1} of {photos.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating QR Code in bottom right for guests to scan live! */}
      <div className="absolute bottom-8 right-8 z-30 bg-black/80 backdrop-blur-xl p-4 rounded-3xl border border-white/20 shadow-2xl flex items-center gap-4 hover:scale-105 transition-transform duration-300">
        <div className="p-2 bg-white rounded-2xl shadow-inner">
          {qrDataUrl && <img src={qrDataUrl} alt="Scan QR" className="w-24 h-24 object-contain" />}
        </div>
        <div className="text-left pr-2">
          <p className="text-xs uppercase tracking-wider text-accent font-bold">Live Sharing</p>
          <p className="text-sm font-extrabold text-white">Scan to Add</p>
          <p className="text-xs text-white/60">Your Photo Here</p>
          {event?.code && (
            <p className="text-xs font-mono font-bold text-accent mt-1">Code: {event.code}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveSlideshowPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
        </div>
      }
    >
      <LiveSlideshowContent />
    </Suspense>
  );
}
