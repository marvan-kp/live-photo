"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  Camera,
  QrCode,
  Upload,
  Tv,
  Calendar,
  MapPin,
  ExternalLink,
  Smartphone,
  Sparkles,
  Heart,
  Loader2,
  Plus
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Event {
  id: string;
  code: string;
  name: string;
  date: string;
  location: string;
  coverUrl: string;
  photosCount: number;
  guestsCount: number;
  status: string;
}

interface Photo {
  id: string;
  name: string;
  url: string;
  guestName?: string;
  caption?: string;
  likes: number;
  createdAt: string;
}

export default function DashboardOverviewPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timestamp = Date.now();
    Promise.all([
      fetch(`/api/events?_t=${timestamp}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/photos?_t=${timestamp}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([evData, phData]) => {
        setEvents(evData.events || []);
        setPhotos(phData.files || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex justify-center text-accent">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Top Banner Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white">Live Operations Center</h2>
          <p className="text-white/60 text-sm">Monitor all live photo events, guest uploads, and QR code access.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/dashboard/events">
            <GlassButton variant="primary" className="text-xs px-4 py-2.5 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Event
            </GlassButton>
          </Link>
          <Link href="/dashboard/qr">
            <GlassButton variant="secondary" className="text-xs px-4 py-2.5 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-accent" /> QR Manager
            </GlassButton>
          </Link>
          <Link href="/dashboard/upload">
            <GlassButton variant="secondary" className="text-xs px-4 py-2.5 flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> Host Upload
            </GlassButton>
          </Link>
          <Link href="/download">
            <GlassButton variant="secondary" className="text-xs px-4 py-2.5 flex items-center gap-1.5 border-accent/40 text-accent">
              <Smartphone className="w-4 h-4" /> Android APK
            </GlassButton>
          </Link>
        </div>
      </div>

      {/* Active Events Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" /> Active Events ({events.length})
          </h3>
          <Link href="/dashboard/events" className="text-xs text-accent hover:underline">
            Manage All Events →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <GlassCard key={event.id} className="p-5 rounded-2xl border-white/15 space-y-4 flex flex-col justify-between hover:border-accent/40 transition-all">
              <div className="space-y-3">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40">
                  <img
                    src={event.coverUrl || "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800"}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2.5 py-1 rounded-md text-[11px] font-mono font-bold text-accent border border-white/10">
                    CODE: {event.code}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-bold text-white truncate">{event.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-white/60 mt-1">
                    <span>{event.date}</span>
                    <span>•</span>
                    <span className="truncate">{event.location}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold text-accent mt-2">
                    <span>{event.photosCount} Photos</span>
                    <span>{event.guestsCount} Guests</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for this Event */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                <Link href={`/event/${event.id}`} target="_blank">
                  <button className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Guest View
                  </button>
                </Link>
                <Link href={`/event/${event.id}/live`} target="_blank">
                  <button className="w-full py-2 px-3 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-accent/30">
                    <Tv className="w-3.5 h-3.5" /> Live Projector
                  </button>
                </Link>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Real-Time Live Photos Feed */}
      <div className="space-y-4 pt-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-accent" /> Live Uploads Stream
            </h3>
            <p className="text-xs text-white/50">Photos appearing live as guests snap and upload them</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Auto-syncing
          </span>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10 text-white/50 text-sm">
            No photos uploaded yet. Guests can scan the QR code to begin uploading!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {photos.slice(0, 12).map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-graphite border border-white/10"
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                  <p className="text-[11px] font-bold text-white truncate">{photo.guestName || "Guest"}</p>
                  <p className="text-[10px] text-accent flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-accent" /> {photo.likes}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
