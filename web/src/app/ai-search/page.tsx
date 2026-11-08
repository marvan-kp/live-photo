"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassNavbar } from "@/components/ui/GlassNavbar";
import {
  Camera,
  Sparkles,
  Upload,
  CheckCircle2,
  Download,
  RotateCcw,
  Heart,
  Loader2,
  Calendar,
  Eye,
  X,
  Share2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface EventItem {
  id: string;
  name: string;
  code: string;
}

interface MatchResult {
  photo: {
    id: string;
    name: string;
    url: string;
    guestName?: string;
    caption?: string;
    likes: number;
    createdAt: string;
  };
  matchScore: number;
  confidence: "High" | "Medium" | "Low";
  tags: string[];
}

function AISearchContent() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams?.get("eventId") || "";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<MatchResult["photo"] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch events list
  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        const list: EventItem[] = data.events || [];
        setEvents(list);
        if (!selectedEventId && list.length > 0) {
          setSelectedEventId(list[0].id);
        }
      })
      .catch((e) => console.error(e));
  }, []);

  const handleSelfieSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelfieFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelfiePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAISearch = async () => {
    if (!selfieFile) {
      alert("Please take or select a selfie first.");
      return;
    }

    setIsProcessing(true);
    setHasSearched(true);

    const formData = new FormData();
    formData.append("action", "match-selfie");
    formData.append("selfie", selfieFile);
    if (selectedEventId) formData.append("eventId", selectedEventId);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      } else {
        alert("AI face recognition could not process the image.");
      }
    } catch (err) {
      console.error("AI Search Error:", err);
      alert("Error processing AI face search.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelfiePreview(null);
    setSelfieFile(null);
    setMatches([]);
    setHasSearched(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden pb-24">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[160px] pointer-events-none" />

      <GlassNavbar />

      <div className="pt-36 max-w-5xl mx-auto px-6 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> 100% Free AI Biometric Matcher
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight">
            Find All Your <span className="text-gradient">Event Photos</span>
          </h1>
          <p className="text-white/60 text-base md:text-lg">
            Snap a selfie. Our on-device AI will scan hundreds of event photographs and find every moment you are in.
          </p>
        </div>

        {/* Search Control Card */}
        <GlassCard className="p-8 rounded-3xl border-white/20 shadow-2xl space-y-6 max-w-3xl mx-auto">
          {/* Step 1: Select Event */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="font-bold text-white text-base">1. Select Event</h3>
              <p className="text-xs text-white/50">Choose which event photos to scan across</p>
            </div>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-graphite border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-accent cursor-pointer"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-midnight text-white">
                  {ev.name} ({ev.code})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Capture or Upload Selfie */}
          <div className="space-y-4">
            <h3 className="font-bold text-white text-base">2. Take or Upload a Quick Selfie</h3>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              id="selfie-file-input"
              onChange={handleSelfieSelected}
            />

            {!selfiePreview ? (
              <label
                htmlFor="selfie-file-input"
                className="cursor-pointer border-2 border-dashed border-white/20 hover:border-accent/60 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 transition-all hover:bg-white/5"
              >
                <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                  <Camera className="w-10 h-10" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-base">Snap a Selfie or Select Photo</p>
                  <p className="text-xs text-white/50 mt-1">Uses your phone/webcam camera or photo library</p>
                </div>
              </label>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-graphite/60 border border-white/10">
                <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-accent shadow-xl flex-shrink-0">
                  <img src={selfiePreview} alt="Your Selfie" className="w-full h-full object-cover" />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-accent/20 backdrop-blur-xs flex items-center justify-center">
                      <div className="w-full h-1 bg-accent animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-green-400 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> Selfie Ready for Biometric Scanning
                  </div>
                  <p className="text-xs text-white/50">
                    AI will map your facial landmarks and scan all photos in <strong>{events.find(e => e.id === selectedEventId)?.name}</strong>.
                  </p>
                  <button
                    onClick={handleReset}
                    className="text-xs text-red-400 hover:underline inline-flex items-center gap-1 pt-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Retake Selfie
                  </button>
                </div>

                <div className="w-full sm:w-auto">
                  <GlassButton
                    variant="primary"
                    onClick={handleRunAISearch}
                    disabled={isProcessing}
                    className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning Faces...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> Find My Photos
                      </>
                    )}
                  </GlassButton>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* AI Results Section */}
        {hasSearched && (
          <div className="space-y-6 pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-accent" /> Matched Photos ({matches.length})
                </h2>
                <p className="text-sm text-white/60">
                  {matches.length > 0
                    ? `Found ${matches.length} photos with matching facial signatures!`
                    : "No matching photos found in this event yet. Check another event or retake your selfie!"}
                </p>
              </div>

              {matches.length > 0 && (
                <button
                  onClick={() => alert(`Downloading all ${matches.length} matched photos in high quality!`)}
                  className="px-5 py-2.5 rounded-full bg-accent text-black font-bold text-xs flex items-center gap-2 hover:bg-accent/90 transition-all shadow-lg"
                >
                  <Download className="w-4 h-4" /> Download All ({matches.length})
                </button>
              )}
            </div>

            {/* Match Cards Grid or Empty State */}
            {matches.length === 0 ? (
              <GlassCard className="p-12 text-center space-y-4 rounded-3xl border-white/10 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">No Matching Photos Found</h3>
                <p className="text-sm text-white/60">
                  We scanned all event photos using neural face matching, but could not find this face in the gallery. Try taking a clearer selfie or check back once more event photos are uploaded!
                </p>
                <GlassButton variant="secondary" onClick={handleReset} className="mx-auto text-xs">
                  Try Another Selfie
                </GlassButton>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {matches.map((item) => (
                  <GlassCard
                    key={item.photo.id}
                    onClick={() => setSelectedPhoto(item.photo)}
                    className="p-3 rounded-2xl border-white/15 hover:border-accent/40 transition-all cursor-pointer group space-y-3"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-black">
                      <img
                        src={item.photo.url}
                        alt={item.photo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* AI Match Percentage Badge */}
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur px-2.5 py-1 rounded-full text-xs font-mono font-bold text-accent border border-accent/40 flex items-center gap-1 shadow-lg">
                        <Sparkles className="w-3 h-3 text-accent" /> {item.matchScore}% Match
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white truncate">{item.photo.guestName || "Guest"}</p>
                      {item.photo.caption && (
                        <p className="text-[11px] text-white/60 truncate">{item.photo.caption}</p>
                      )}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.tags.map((tag) => (
                          <span key={tag} className="text-[9px] bg-white/10 px-2 py-0.5 rounded-md text-white/70">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Photo Lightbox Modal */}
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
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.name}
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="w-full mt-4 flex items-center justify-between px-4 text-white">
              <div>
                <p className="font-bold">{selectedPhoto.guestName || "Guest"}</p>
                {selectedPhoto.caption && <p className="text-sm text-white/70">{selectedPhoto.caption}</p>}
              </div>
              <a
                href={selectedPhoto.url}
                download={selectedPhoto.name}
                target="_blank"
                rel="noreferrer"
                className="bg-accent text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-accent/90"
              >
                <Download className="w-4 h-4" /> Download Photo
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AISearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      }
    >
      <AISearchContent />
    </Suspense>
  );
}
