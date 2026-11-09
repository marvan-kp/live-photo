"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { QRCodeCard } from "@/components/ui/QRCodeCard";
import {
  Camera,
  Upload,
  Heart,
  Download,
  Share2,
  Tv,
  Calendar,
  MapPin,
  Sparkles,
  Loader2,
  CheckCircle2,
  Smartphone,
  X,
  Search,
  Wand2,
  Filter
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface EventData {
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

interface PhotoData {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  guestName?: string;
  caption?: string;
  likes: number;
}

const AI_FILTER_TAGS = ["All", "⭐ AI Highlights", "💃 Dance", "🥂 Toast", "💍 Romance", "👥 Group", "🌅 Sunset"];

function GuestEventContent() {
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<PhotoData[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const [isPhotoEnhanced, setIsPhotoEnhanced] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load guest name from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("livephoto_guest_name");
      if (saved) setGuestName(saved);
    }
  }, []);

  // Fetch event and photos
  const fetchEventData = async () => {
    if (!eventId) return;
    try {
      const [resEvent, resPhotos] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/photos?eventId=${eventId}`)
      ]);
      if (resEvent.ok) {
        const evData = await resEvent.json();
        setEvent(evData.event);
      }
      if (resPhotos.ok) {
        const phData = await resPhotos.json();
        const list: PhotoData[] = phData.files || [];
        setPhotos(list);
      }
    } catch (err) {
      console.error("Error fetching event data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
    const interval = setInterval(fetchEventData, 4000);
    return () => clearInterval(interval);
  }, [eventId]);

  // AI Tag & Keyword Filtering
  useEffect(() => {
    let list = [...photos];

    if (activeFilter === "⭐ AI Highlights") {
      list = list.sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 8);
    } else if (activeFilter !== "All") {
      const tagTerm = activeFilter.replace(/^[^\w\s]+/, "").trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(tagTerm) ||
          p.caption?.toLowerCase().includes(tagTerm) ||
          p.guestName?.toLowerCase().includes(tagTerm)
      );
    }

    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.caption?.toLowerCase().includes(q) ||
          p.guestName?.toLowerCase().includes(q)
      );
    }

    setFilteredPhotos(list);
  }, [photos, activeFilter, searchKeyword]);

  const handleGenerateAICaption = async () => {
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-caption",
          eventName: event?.name,
          tag: activeFilter.toLowerCase().includes("dance")
            ? "dance"
            : activeFilter.toLowerCase().includes("toast")
            ? "toast"
            : activeFilter.toLowerCase().includes("romance")
            ? "romance"
            : "candid",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.caption) {
          setCaption(data.caption);
          return;
        }
      }
    } catch (_) {}

    const suggestions = [
      `Cherishing unforgettable moments at ${event?.name || "the party"}! ✨🥂 #Memories2026`,
      "Lighting up the dance floor! What an incredible celebration 💃🔥 #GoodTimes",
      "Laughter, love, and a night to remember forever ❤️🥂 #LiveMoments",
      "Best table at the party! Making memories that last a lifetime ✨🍾",
      "Pure joy and golden hour vibes! 🌅✨ #Celebration"
    ];
    const picked = suggestions[Math.floor(Math.random() * suggestions.length)];
    setCaption(picked);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadSuccess(false);

    if (guestName && typeof window !== "undefined") {
      localStorage.setItem("livephoto_guest_name", guestName);
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    if (event?.id) formData.append("eventId", event.id);
    if (guestName) formData.append("guestName", guestName);
    if (caption) formData.append("caption", caption);

    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadSuccess(true);
        setCaption("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchEventData();
        setTimeout(() => setUploadSuccess(false), 4000);
      } else {
        alert("Upload failed. Please try again.");
      }
    } catch (err) {
      alert("Error uploading photos.");
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Instantly increment optimistically so rapid continuous clicks immediately increase count
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, likes: (p.likes || 0) + 1 } : p))
    );
    if (selectedPhoto && selectedPhoto.id === photoId) {
      setSelectedPhoto((prev) => (prev ? { ...prev, likes: (prev.likes || 0) + 1 } : null));
    }

    try {
      await fetch("/api/photos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "like", photoId }),
      });
    } catch (err) {
      console.error("Failed to like photo", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center text-white">
        <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
        <p className="text-white/60 mb-6">The event you are looking for does not exist or has been removed.</p>
        <Link href="/">
          <GlassButton variant="primary">Return Home</GlassButton>
        </Link>
      </div>
    );
  }

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      {/* Event Header Banner */}
      <div className="relative h-72 md:h-96 w-full overflow-hidden">
        <Image
          src={event.coverUrl || "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1600"}
          alt={event.name}
          fill
          className="object-cover brightness-50"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 max-w-5xl mx-auto p-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Live Photo Sharing
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-accent" /> {event.date}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-accent" /> {event.location}</span>
              <span className="text-accent font-mono font-bold bg-white/10 px-2.5 py-0.5 rounded-md">CODE: {event.code}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/ai-search?eventId=${event.id}`}>
              <GlassButton variant="primary" className="text-xs px-3.5 py-2 flex items-center gap-1.5 shadow-lg">
                <Sparkles className="w-4 h-4" /> Find My Photos
              </GlassButton>
            </Link>
            <Link href={`/event/${event.id}/live`}>
              <GlassButton variant="secondary" className="text-xs px-3 py-2 flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-accent" /> Live Stage Wall
              </GlassButton>
            </Link>
            <a href={`/api/events/${event.id}/download`} download>
              <GlassButton variant="secondary" className="text-xs px-3 py-2 flex items-center gap-1.5 text-accent hover:text-white">
                <Download className="w-4 h-4" /> Download ZIP
              </GlassButton>
            </a>
            <GlassButton
              variant="secondary"
              className="text-xs px-3 py-2 flex items-center gap-1.5"
              onClick={() => setShowQrModal(true)}
            >
              <Share2 className="w-4 h-4" /> Share QR
            </GlassButton>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8 space-y-8">
        {/* Upload Action Bar */}
        <GlassCard className="p-6 rounded-3xl border-white/20 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-accent" /> Share Your Photo
                </h3>
                <button
                  onClick={handleGenerateAICaption}
                  type="button"
                  className="text-xs text-accent hover:underline flex items-center gap-1 bg-accent/10 px-2.5 py-1 rounded-full border border-accent/20"
                >
                  <Wand2 className="w-3 h-3" /> AI Caption Suggest
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Your Name (e.g. Jessica)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-graphite/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Caption or wishes..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-graphite/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                id="guest-photo-input"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label
                htmlFor="guest-photo-input"
                className={`cursor-pointer w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm tracking-wide transition-all shadow-lg ${
                  uploading
                    ? "bg-accent/50 text-black cursor-wait"
                    : "bg-accent hover:bg-accent/90 text-black hover:scale-105 active:scale-95"
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" /> Snap & Upload Photo
                  </>
                )}
              </label>
            </div>
          </div>

          {uploadSuccess && (
            <div className="mt-4 p-3 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Photo uploaded! It is now live on the event stream!
            </div>
          )}
        </GlassCard>

        {/* AI Filter Tags & Live Grid Header */}
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Live Gallery <span className="text-sm font-normal text-white/50">({filteredPhotos.length} photos)</span>
              </h2>
            </div>

            {/* Smart Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
              <input
                type="text"
                placeholder="Search moments..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full bg-graphite/60 border border-white/10 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* AI Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {AI_FILTER_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveFilter(tag)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === tag
                    ? "bg-accent text-black shadow-md scale-105"
                    : "bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Photos Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 space-y-4">
            <Camera className="w-16 h-16 mx-auto text-white/20" />
            <h3 className="text-xl font-bold text-white">No photos matched</h3>
            <p className="text-white/50 max-w-sm mx-auto text-sm">
              Try switching your filter or be the first to upload for this tag!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => {
                  setSelectedPhoto(photo);
                  setIsPhotoEnhanced(false);
                }}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-graphite border border-white/10 cursor-pointer hover:border-accent/40 transition-all hover:scale-[1.02] duration-300"
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                  <p className="text-xs font-bold text-white truncate">{photo.guestName || "Guest"}</p>
                  {photo.caption && <p className="text-[11px] text-white/70 truncate">{photo.caption}</p>}
                </div>
                {/* Like Button */}
                <button
                  onClick={(e) => handleLike(photo.id, e)}
                  className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-xs flex items-center gap-1 border border-white/20 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Heart className={`w-3.5 h-3.5 ${photo.likes > 0 ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{photo.likes || 0}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mobile APK Promotion Banner */}
        <GlassCard className="p-6 rounded-3xl border-white/15 bg-gradient-to-r from-accent/10 via-transparent to-transparent flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-left">
            <div className="p-3 bg-accent/20 rounded-2xl text-accent">
              <Smartphone className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-white">Get the Live Photo Share Android App</h4>
              <p className="text-xs text-white/60">Built-in AI Face Finder, Pro Camera modes, and instant live sync.</p>
            </div>
          </div>
          <Link href="/download">
            <GlassButton variant="primary" className="text-xs whitespace-nowrap px-6 py-2.5">
              Download Free APK
            </GlassButton>
          </Link>
        </GlassCard>
      </div>

      {/* Fullscreen Photo Lightbox Modal with AI Auto-Enhance */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-6 right-6 text-white/80 hover:text-white p-2 rounded-full bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                style={{
                  filter: isPhotoEnhanced
                    ? "contrast(1.15) saturate(1.25) brightness(1.05)"
                    : "none",
                  transition: "filter 0.4s ease"
                }}
                className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
              />
              {isPhotoEnhanced && (
                <div className="absolute top-3 left-3 bg-accent text-black font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <Wand2 className="w-3 h-3" /> AI Enhanced
                </div>
              )}
            </div>

            <div className="w-full mt-4 flex flex-wrap items-center justify-between gap-4 px-4 text-white">
              <div>
                <p className="font-bold">{selectedPhoto.guestName || "Guest"}</p>
                {selectedPhoto.caption && <p className="text-sm text-white/70">{selectedPhoto.caption}</p>}
                <p className="text-xs text-white/40">{new Date(selectedPhoto.createdAt).toLocaleTimeString()}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPhotoEnhanced(!isPhotoEnhanced)}
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all border ${
                    isPhotoEnhanced
                      ? "bg-accent text-black border-accent"
                      : "bg-white/10 text-white hover:bg-white/20 border-white/20"
                  }`}
                >
                  <Wand2 className="w-4 h-4" /> {isPhotoEnhanced ? "Enhanced (ON)" : "AI Auto-Enhance"}
                </button>

                <button
                  onClick={(e) => handleLike(selectedPhoto.id, e)}
                  className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-xs border border-white/20"
                >
                  <Heart className={`w-4 h-4 ${selectedPhoto.likes > 0 ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{selectedPhoto.likes || 0}</span>
                </button>

                <a
                  href={selectedPhoto.url}
                  download={selectedPhoto.name}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-accent text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-xs hover:bg-accent/90"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share QR Modal */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white p-2 rounded-full bg-white/10"
            >
              <X className="w-6 h-6" />
            </button>
            <QRCodeCard
              url={currentUrl}
              title={`Join ${event.name}`}
              subtitle="Scan with any camera or QR scanner to join"
              code={event.code}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function GuestEventPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      }
    >
      <GuestEventContent />
    </Suspense>
  );
}
