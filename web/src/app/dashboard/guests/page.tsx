"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  Users,
  Camera,
  Heart,
  Search,
  Plus,
  Loader2,
  Calendar,
  Sparkles,
  Eye,
  Download,
  X,
  Mail,
  Award,
  Clock,
  CheckCircle2,
  Share2,
} from "lucide-react";

interface GuestPhoto {
  id: string;
  url: string;
  name: string;
  caption?: string;
  likes: number;
  createdAt: string;
  eventId?: string;
}

interface GuestItem {
  id: string;
  name: string;
  email?: string;
  role: string;
  events: { id: string; name: string; code: string }[];
  photosCount: number;
  totalLikes: number;
  firstSeen: string;
  lastActive: string;
  photos: GuestPhoto[];
}

interface GuestsSummary {
  totalGuests: number;
  totalPhotos: number;
  totalLikes: number;
  topContributor: { name: string; photosCount: number; totalLikes: number } | null;
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [summary, setSummary] = useState<GuestsSummary>({
    totalGuests: 0,
    totalPhotos: 0,
    totalLikes: 0,
    topContributor: null,
  });
  const [events, setEvents] = useState<{ id: string; name: string; code: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"photos" | "likes" | "recent">("photos");

  // Modals
  const [inspectGuest, setInspectGuest] = useState<GuestItem | null>(null);
  const [activePhotoModal, setActivePhotoModal] = useState<GuestPhoto | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newGuestData, setNewGuestData] = useState({
    name: "",
    email: "",
    phone: "",
    eventId: "marvan-live-2026",
    role: "VIP Guest",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchGuests();
    fetchEvents();
  }, []);

  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/guests");
      const data = await res.json();
      if (data.success) {
        setGuests(data.guests);
        setSummary(data.summary);
      }
    } catch (e) {
      console.error("Failed to load guests:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (e) {
      console.error("Failed to load events:", e);
    }
  };

  const handleRegisterGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGuestData),
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewGuestData({
          name: "",
          email: "",
          phone: "",
          eventId: events[0]?.id || "marvan-live-2026",
          role: "VIP Guest",
        });
        fetchGuests();
      }
    } catch (err) {
      console.error("Error creating guest:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Sort
  const filteredGuests = useMemo(() => {
    return guests
      .filter((g) => {
        const matchesQuery =
          !searchQuery.trim() ||
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.events.some((ev) => ev.name.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesEvent =
          selectedEventId === "all" ||
          g.events.some((ev) => ev.id === selectedEventId || ev.code === selectedEventId);

        return matchesQuery && matchesEvent;
      })
      .sort((a, b) => {
        if (sortBy === "photos") return b.photosCount - a.photosCount;
        if (sortBy === "likes") return b.totalLikes - a.totalLikes;
        if (sortBy === "recent") return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
        return 0;
      });
  }, [guests, searchQuery, selectedEventId, sortBy]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recent";
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Guests & Contributors</h1>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-accent/20 text-accent border border-accent/30">
              Live Sync
            </span>
          </div>
          <p className="text-white/60 text-sm mt-1">
            Real-time roster of attendees, live photo uploaders, and community interactions across galleries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Register Guest
          </GlassButton>
        </div>
      </div>

      {/* Key Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <GlassCard className="p-5 flex items-center gap-4 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium">Total Guests</div>
            <div className="text-2xl font-bold text-white mt-0.5">{summary.totalGuests}</div>
            <div className="text-xs text-accent mt-0.5 font-medium">Active in Galleries</div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex items-center gap-4 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium">Guest Photos</div>
            <div className="text-2xl font-bold text-white mt-0.5">{summary.totalPhotos}</div>
            <div className="text-xs text-blue-400 mt-0.5 font-medium">Uploaded & Synced</div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex items-center gap-4 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium">Total Likes</div>
            <div className="text-2xl font-bold text-white mt-0.5">{summary.totalLikes}</div>
            <div className="text-xs text-rose-400 mt-0.5 font-medium">Community Hearts</div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 flex items-center gap-4 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="truncate">
            <div className="text-xs text-white/50 uppercase tracking-wider font-medium">Top Contributor</div>
            <div className="text-lg font-bold text-white mt-0.5 truncate">
              {summary.topContributor?.name || "Signature by Marvan"}
            </div>
            <div className="text-xs text-amber-400 mt-0.5 font-medium">
              {summary.topContributor?.photosCount || 0} photos shared
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Search & Filter Toolbar */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guests by name, email, or event..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Event Filter */}
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="all" className="bg-neutral-900 text-white">All Events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-neutral-900 text-white">
                  {ev.name} ({ev.code})
                </option>
              ))}
            </select>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="photos" className="bg-neutral-900 text-white">Sort: Most Photos</option>
              <option value="likes" className="bg-neutral-900 text-white">Sort: Most Likes</option>
              <option value="recent" className="bg-neutral-900 text-white">Sort: Most Recent</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Guests Roster Grid / Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <span className="text-white/60 text-sm">Aggregating guest roster and live interactions...</span>
        </div>
      ) : filteredGuests.length === 0 ? (
        <GlassCard className="text-center py-16">
          <Users className="w-12 h-12 text-white/30 mx-auto mb-3" />
          <h3 className="text-xl font-semibold text-white">No guests found</h3>
          <p className="text-white/50 text-sm mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No guest matches "${searchQuery}". Try clearing search filters.`
              : "No guests have uploaded photos yet. Share the event QR code or register guests manually!"}
          </p>
          <GlassButton
            variant="secondary"
            onClick={() => {
              setSearchQuery("");
              setSelectedEventId("all");
            }}
            className="mt-5"
          >
            Reset Filters
          </GlassButton>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredGuests.map((guest, idx) => {
              const isHost = guest.name.toLowerCase().includes("marvan") || guest.role.includes("Host");
              const isAndroid = guest.name.toLowerCase().includes("android");

              return (
                <motion.div
                  key={guest.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                >
                  <GlassCard className="p-5 flex flex-col justify-between h-full border-white/10 hover:border-accent/40 transition-all duration-300 group">
                    <div>
                      {/* Top Row: Avatar & Role */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm tracking-wider uppercase shadow-md ${
                              isHost
                                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black border border-amber-300"
                                : isAndroid
                                ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"
                                : "bg-gradient-to-br from-neutral-700 to-neutral-800 text-accent border border-white/10"
                            }`}
                          >
                            {getInitials(guest.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white text-base leading-tight group-hover:text-accent transition-colors">
                                {guest.name}
                              </h3>
                              {isHost && (
                                <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-white/50 flex items-center gap-1 mt-0.5">
                              {guest.role}
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 text-white/70">
                          {guest.events[0]?.code || "MARVAN"}
                        </span>
                      </div>

                      {/* Events Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {guest.events.map((ev) => (
                          <span
                            key={ev.id}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/5"
                          >
                            <Calendar className="w-3 h-3 text-accent" />
                            {ev.name}
                          </span>
                        ))}
                      </div>

                      {/* Metrics: Photos, Likes & Last Active */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 text-center mb-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/40">Photos</div>
                          <div className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                            <Camera className="w-3.5 h-3.5 text-blue-400" />
                            {guest.photosCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/40">Likes</div>
                          <div className="text-sm font-bold text-white flex items-center justify-center gap-1 mt-0.5">
                            <Heart className="w-3.5 h-3.5 text-rose-400" />
                            {guest.totalLikes}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
                          <div className="text-[11px] font-medium text-white/70 truncate mt-0.5" title={formatDate(guest.lastActive)}>
                            {formatDate(guest.lastActive)}
                          </div>
                        </div>
                      </div>

                      {/* Recent Photos Preview Thumbnails */}
                      {guest.photos.length > 0 && (
                        <div className="flex items-center gap-2 mb-4 overflow-hidden">
                          {guest.photos.slice(0, 4).map((p) => (
                            <div
                              key={p.id}
                              onClick={() => setActivePhotoModal(p)}
                              className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/10 cursor-pointer hover:border-accent hover:scale-105 transition-all flex-shrink-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {guest.photos.length > 4 && (
                            <button
                              onClick={() => setInspectGuest(guest)}
                              className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-xs font-semibold text-white/80 transition-colors flex-shrink-0"
                            >
                              +{guest.photos.length - 4}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                      <GlassButton
                        variant="secondary"
                        onClick={() => setInspectGuest(guest)}
                        className="w-full text-xs py-2 flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Gallery ({guest.photosCount})
                      </GlassButton>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Guest Photos Modal */}
      <AnimatePresence>
        {inspectGuest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-4xl max-h-[90vh] rounded-3xl p-6 border-white/20 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold">
                    {getInitials(inspectGuest.name)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      {inspectGuest.name}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-normal">
                        {inspectGuest.role}
                      </span>
                    </h2>
                    <p className="text-xs text-white/50">
                      {inspectGuest.photosCount} photos shared · {inspectGuest.totalLikes} total likes
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setInspectGuest(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Photos Grid in Modal */}
              <div className="flex-1 overflow-y-auto py-6 pr-2">
                {inspectGuest.photos.length === 0 ? (
                  <div className="text-center py-12 text-white/50 text-sm">
                    No photos uploaded by this guest yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {inspectGuest.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group relative rounded-xl overflow-hidden bg-black/50 border border-white/10 aspect-square flex flex-col justify-end cursor-pointer"
                        onClick={() => setActivePhotoModal(photo)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                          <p className="text-xs text-white truncate font-medium">{photo.name}</p>
                          <div className="flex items-center justify-between text-[11px] text-white/70 mt-1">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                              {photo.likes}
                            </span>
                            <span className="text-[10px]">{formatDate(photo.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
                <span>Guest ID: {inspectGuest.id}</span>
                <GlassButton variant="secondary" onClick={() => setInspectGuest(null)}>
                  Close
                </GlassButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enlarged Photo Preview Modal */}
      <AnimatePresence>
        {activePhotoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            >
              <button
                onClick={() => setActivePhotoModal(null)}
                className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhotoModal.url}
                alt={activePhotoModal.name}
                className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain border border-white/20 shadow-2xl"
              />
              <div className="flex items-center justify-between w-full mt-3 px-2 text-sm text-white/70">
                <span className="truncate">{activePhotoModal.name}</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-rose-400">
                    <Heart className="w-4 h-4 fill-rose-400" /> {activePhotoModal.likes} likes
                  </span>
                  <a
                    href={activePhotoModal.url}
                    download={activePhotoModal.name}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Register / Invite Guest Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-md rounded-3xl p-6 border-white/20 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  Register New Guest
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-white/60 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterGuest} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Guest Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGuestData.name}
                    onChange={(e) => setNewGuestData({ ...newGuestData, name: e.target.value })}
                    placeholder="e.g. Alexander Smith"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newGuestData.email}
                    onChange={(e) => setNewGuestData({ ...newGuestData, email: e.target.value })}
                    placeholder="guest@example.com"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">
                      Role / Badge
                    </label>
                    <select
                      value={newGuestData.role}
                      onChange={(e) => setNewGuestData({ ...newGuestData, role: e.target.value })}
                      className="w-full px-3 py-2.5 bg-neutral-900 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-accent"
                    >
                      <option value="VIP Guest">VIP Guest</option>
                      <option value="Speaker">Speaker</option>
                      <option value="Family & Friends">Family & Friends</option>
                      <option value="Official Photographer">Official Photographer</option>
                      <option value="Attendee">Attendee</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">
                      Target Event
                    </label>
                    <select
                      value={newGuestData.eventId}
                      onChange={(e) => setNewGuestData({ ...newGuestData, eventId: e.target.value })}
                      className="w-full px-3 py-2.5 bg-neutral-900 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-accent"
                    >
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                  <GlassButton
                    type="button"
                    variant="secondary"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </GlassButton>
                  <GlassButton type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Register Guest
                  </GlassButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

