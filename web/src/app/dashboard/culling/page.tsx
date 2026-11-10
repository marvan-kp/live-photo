"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Trash2,
  RefreshCw,
  Layers,
  ScanEye,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EventItem {
  id: string;
  name: string;
  code: string;
}

interface CullingConfig {
  enabled: boolean;
  autoHideCulled: boolean;
  sharpnessThreshold: number;
  blinkDetection: boolean;
  burstDeduplication: boolean;
  burstWindowSeconds: number;
  strictness: "relaxed" | "balanced" | "strict";
}

interface PhotoItem {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  eventId?: string;
  guestName?: string;
  likes: number;
  qualityScore?: number;
  cullStatus?: "approved" | "blurry" | "blink" | "duplicate" | "underexposed" | "overexposed";
  isCulled?: boolean;
  aiReason?: string;
  burstGroupId?: string;
}

interface CullingStats {
  total: number;
  approved: number;
  culled: number;
  blurry: number;
  blink: number;
  duplicate: number;
  exposure: number;
}

export default function AICullingPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [config, setConfig] = useState<CullingConfig>({
    enabled: true,
    autoHideCulled: true,
    sharpnessThreshold: 40,
    blinkDetection: true,
    burstDeduplication: true,
    burstWindowSeconds: 3,
    strictness: "balanced",
  });
  const [stats, setStats] = useState<CullingStats>({
    total: 0,
    approved: 0,
    culled: 0,
    blurry: 0,
    blink: 0,
    duplicate: 0,
    exposure: 0,
  });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "approved" | "culled" | "burst">("all");
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  };

  const loadData = async (evId?: string) => {
    setLoading(true);
    try {
      const targetEv = evId !== undefined ? evId : selectedEventId;
      const url = targetEv ? `/api/culling?eventId=${encodeURIComponent(targetEv)}` : "/api/culling";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        if (data.stats) setStats(data.stats);
        if (Array.isArray(data.photos)) setPhotos(data.photos);
      }
    } catch (e) {
      console.error("Failed to load culling data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        const list: EventItem[] = data.events || [];
        setEvents(list);
      })
      .catch(() => {});
    loadData("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEventChange = (evId: string) => {
    setSelectedEventId(evId);
    loadData(evId);
  };

  const handleUpdateConfig = async (patch: Partial<CullingConfig>) => {
    const nextConfig = { ...config, ...patch };
    setConfig(nextConfig);
    try {
      const res = await fetch("/api/culling", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "marvan2026",
        },
        body: JSON.stringify({ action: "update-config", config: nextConfig }),
      });
      if (res.ok) {
        showToast("✓ AI Culling preferences saved");
      }
    } catch (_) {}
  };

  const handleTogglePhoto = async (photo: PhotoItem) => {
    const nextCulled = !photo.isCulled;
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photo.id
          ? {
              ...p,
              isCulled: nextCulled,
              cullStatus: nextCulled ? "blurry" : "approved",
              aiReason: nextCulled ? "Manually culled by Photographer" : "Approved & Published ⭐",
            }
          : p
      )
    );

    try {
      const res = await fetch("/api/culling", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "marvan2026",
        },
        body: JSON.stringify({
          action: "toggle-photo",
          photoId: photo.id,
          isCulled: nextCulled,
          cullStatus: nextCulled ? "blurry" : "approved",
        }),
      });
      if (res.ok) {
        await loadData();
        showToast(nextCulled ? "Photo moved to Culled Bin" : "Photo restored to Live Guest Stream ⭐");
      }
    } catch (_) {}
  };

  const handleRunBatchScan = async () => {
    setProcessingAction("batch-cull");
    try {
      const res = await fetch("/api/culling", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "marvan2026",
        },
        body: JSON.stringify({
          action: "batch-cull",
          eventId: selectedEventId || undefined,
          burstWindowSeconds: config.burstWindowSeconds,
          reanalyze: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadData();
        showToast(`✓ AI Scanned ${data.count} photos — ${data.culledCount} flagged/deduplicated`);
      }
    } catch (e: any) {
      showToast(`Scan error: ${e.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleApproveAll = async () => {
    setProcessingAction("approve-all");
    try {
      const res = await fetch("/api/culling", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "marvan2026",
        },
        body: JSON.stringify({
          action: "approve-all",
          eventId: selectedEventId || undefined,
        }),
      });
      if (res.ok) {
        await loadData();
        showToast("✓ All photos approved and published to guests!");
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const handlePurgeCulled = async () => {
    if (stats.culled === 0) return;
    const confirmed = window.confirm(
      `Permanently delete ${stats.culled} culled/blurry photos? This frees storage and cannot be undone.`
    );
    if (!confirmed) return;

    setProcessingAction("purge");
    try {
      const res = await fetch("/api/culling", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "marvan2026",
        },
        body: JSON.stringify({
          action: "batch-delete-culled",
          eventId: selectedEventId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadData();
        showToast(`🗑️ Purged ${data.deletedCount} culled shots`);
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const filteredPhotos = photos.filter((p) => {
    if (filterTab === "approved") return !p.isCulled;
    if (filterTab === "culled") return !!p.isCulled;
    if (filterTab === "burst") return !!p.burstGroupId || p.cullStatus === "duplicate";
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {statusToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl bg-midnight border border-accent/40 text-accent text-xs font-bold shadow-2xl flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {statusToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Event Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <ScanEye className="w-8 h-8 text-accent" />
              AI Smart Culling & Blink Filter
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              2D Laplacian Engine
            </span>
          </div>
          <p className="text-white/60 text-sm mt-1">
            Automatically detects motion blur, closed eyes, bad exposure, and burst duplicates before guests see them.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-graphite/80 border border-white/10 px-4 py-2 rounded-2xl">
          <span className="text-xs text-white/50 uppercase tracking-wider font-semibold">Scope:</span>
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-midnight text-white">All Events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id} className="bg-midnight text-white">
                {ev.name} ({ev.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <GlassCard className="p-4 border-white/10">
          <p className="text-xs text-white/50">Total Analyzed</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </GlassCard>
        <GlassCard className="p-4 border-emerald-500/20 bg-emerald-500/[0.03]">
          <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Live Approved
          </p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.approved}</p>
        </GlassCard>
        <GlassCard className="p-4 border-amber-500/20 bg-amber-500/[0.03]">
          <p className="text-xs text-amber-400 font-semibold flex items-center gap-1">
            <EyeOff className="w-3.5 h-3.5" /> Hidden / Culled
          </p>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.culled}</p>
        </GlassCard>
        <GlassCard className="p-4 border-white/10">
          <p className="text-xs text-white/50">Blur & Blink Flags</p>
          <p className="text-2xl font-black text-red-400 mt-1">{stats.blurry + stats.blink}</p>
        </GlassCard>
        <GlassCard className="p-4 border-white/10">
          <p className="text-xs text-white/50">Burst Duplicates</p>
          <p className="text-2xl font-black text-accent mt-1">{stats.duplicate}</p>
        </GlassCard>
      </div>

      {/* AI Engine Settings & Batch Actions */}
      <GlassCard className="p-6 border-white/15 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/15 text-accent border border-accent/25">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Automated Culling Rules</h3>
              <p className="text-xs text-white/50">Applied instantaneously on Camera Tether, Mobile & Web uploads</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <GlassButton
              variant="primary"
              onClick={handleRunBatchScan}
              disabled={processingAction !== null}
              className="text-xs px-4 py-2.5 flex items-center gap-2 font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${processingAction === "batch-cull" ? "animate-spin" : ""}`} />
              Run AI Burst & Focus Scan
            </GlassButton>

            <GlassButton
              variant="secondary"
              onClick={handleApproveAll}
              disabled={processingAction !== null}
              className="text-xs px-4 py-2.5 flex items-center gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Approve All
            </GlassButton>

            {stats.culled > 0 && (
              <button
                onClick={handlePurgeCulled}
                disabled={processingAction !== null}
                className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purge {stats.culled} Culled
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
          {/* Master Toggle */}
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer">
            <div>
              <span className="font-bold text-white block">AI Culling Active</span>
              <span className="text-[11px] text-white/50">Auto-score uploads</span>
            </div>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleUpdateConfig({ enabled: e.target.checked })}
              className="accent-accent w-4 h-4 cursor-pointer"
            />
          </label>

          {/* Auto-Hide Toggle */}
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer">
            <div>
              <span className="font-bold text-white block">Auto-Hide Rejected</span>
              <span className="text-[11px] text-white/50">Hide blur/blinks from guests</span>
            </div>
            <input
              type="checkbox"
              checked={config.autoHideCulled}
              onChange={(e) => handleUpdateConfig({ autoHideCulled: e.target.checked })}
              className="accent-accent w-4 h-4 cursor-pointer"
            />
          </label>

          {/* Strictness Selector */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
            <span className="font-bold text-white block">Culling Strictness</span>
            <div className="grid grid-cols-3 gap-1">
              {(["relaxed", "balanced", "strict"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => handleUpdateConfig({ strictness: level })}
                  className={`py-1 rounded-lg capitalize font-semibold text-[11px] transition-all cursor-pointer ${
                    config.strictness === level
                      ? "bg-accent text-midnight font-bold"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Burst Window */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
            <div className="flex justify-between">
              <span className="font-bold text-white">Burst Grouping Window</span>
              <span className="text-accent font-mono font-bold">{config.burstWindowSeconds}s</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[2, 3, 5].map((sec) => (
                <button
                  key={sec}
                  onClick={() => handleUpdateConfig({ burstWindowSeconds: sec })}
                  className={`py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                    config.burstWindowSeconds === sec
                      ? "bg-accent text-midnight font-bold"
                      : "bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {sec} sec
                </button>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: `All Shots (${stats.total})` },
          { key: "approved", label: `⭐ Approved (${stats.approved})` },
          { key: "culled", label: `🚫 Culled / Hidden (${stats.culled})` },
          { key: "burst", label: `📸 Burst Grouped (${stats.duplicate})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === tab.key
                ? "bg-accent/20 text-accent border border-accent/40"
                : "bg-white/[0.03] text-white/60 border border-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Photo Inspection Grid */}
      {loading ? (
        <div className="py-20 text-center text-accent">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-xs text-white/60">Loading AI quality inspector...</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <GlassCard className="p-12 text-center space-y-3 border-white/10">
          <Layers className="w-10 h-10 text-white/30 mx-auto" />
          <p className="text-sm font-bold text-white">No photos in this filter view</p>
          <p className="text-xs text-white/50">
            Upload new shots via Live Tether or Dashboard Upload to see AI sharpness and blink scoring in action.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredPhotos.map((photo) => {
            const score = photo.qualityScore ?? 85;
            const culled = !!photo.isCulled;

            return (
              <GlassCard
                key={photo.id}
                className={`overflow-hidden flex flex-col border transition-all ${
                  culled
                    ? "border-amber-500/40 bg-amber-950/10"
                    : "border-white/15 hover:border-accent/40"
                }`}
              >
                {/* Image Thumbnail */}
                <div className="relative aspect-[4/3] bg-black/50 overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.name}
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      culled ? "opacity-50 grayscale-[35%]" : "group-hover:scale-105"
                    }`}
                  />

                  {/* Top-Left Quality Score Badge */}
                  <div
                    className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-black backdrop-blur-md border shadow-lg ${
                      score >= 75
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                        : score >= 50
                        ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                        : "bg-red-950/80 text-red-300 border-red-500/40"
                    }`}
                  >
                    {score}% Score
                  </div>

                  {/* Top-Right Status Badge */}
                  <div
                    className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                      culled
                        ? "bg-red-950/85 text-red-300 border-red-500/40"
                        : "bg-black/75 text-accent border-accent/40"
                    }`}
                  >
                    {culled ? photo.cullStatus || "Culled" : "Live ⭐"}
                  </div>
                </div>

                {/* Details & Action */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white truncate">{photo.name}</p>
                    <p className="text-[11px] text-white/60 flex items-start gap-1.5 leading-snug">
                      {culled ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <span>{photo.aiReason || (culled ? "Flagged by AI" : "Crisp Focus & Great Moment")}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleTogglePhoto(photo)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      culled
                        ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30"
                        : "bg-white/5 hover:bg-amber-500/15 text-white/70 hover:text-amber-300 border-white/10 hover:border-amber-500/30"
                    }`}
                  >
                    {culled ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Approve & Publish
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Cull & Hide Shot
                      </>
                    )}
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
