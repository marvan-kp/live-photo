"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  Camera,
  FolderOpen,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Terminal,
  FileImage,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface EventItem {
  id: string;
  name: string;
  code: string;
  location: string;
  photosCount?: number;
}

interface UploadLog {
  id: string;
  filename: string;
  timestamp: string;
  status: "pending" | "uploading" | "success" | "error";
  latencyMs?: number;
  previewUrl?: string;
  sizeKb?: number;
  error?: string;
}

export default function CameraTetherPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [photographerName, setPhotographerName] = useState("Signature by Marvan");
  const [caption, setCaption] = useState("Live Camera Shot 📸");

  // Tether Watcher States
  const [isWatching, setIsWatching] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<"browser" | "cli">("browser");
  const [copiedCli, setCopiedCli] = useState(false);

  // Stats
  const [totalSynced, setTotalSynced] = useState(0);
  const [avgLatency, setAvgLatency] = useState<number | null>(null);

  // References for File System Access API
  const dirHandleRef = useRef<any>(null);
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());
  const isScanningRef = useRef(false);

  // Load events
  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        const evList: EventItem[] = data.events || [];
        setEvents(evList);
        if (evList.length > 0) {
          setSelectedEventId(evList[0].id);
        }
      })
      .catch((err) => console.error("Error loading events:", err));
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  // Play audio chime on photo uploaded
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (_) {}
  };

  // Upload a single file from camera tethering
  const uploadTetherFile = async (file: File) => {
    const startTime = performance.now();
    const logId = `${file.name}-${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);

    const newLog: UploadLog = {
      id: logId,
      filename: file.name,
      timestamp: new Date().toLocaleTimeString(),
      status: "uploading",
      previewUrl,
      sizeKb: Math.round(file.size / 1024),
    };

    setLogs((prev) => [newLog, ...prev.slice(0, 49)]);

    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("eventId", selectedEventId || selectedEvent?.id || "default");
      formData.append("guestName", photographerName.trim() || "Photographer");
      formData.append("caption", caption.trim());
      formData.append("adminKey", "marvan2026");

      const res = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "x-admin-key": "marvan2026",
        },
        body: formData,
      });

      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        setLogs((prev) =>
          prev.map((l) =>
            l.id === logId
              ? { ...l, status: "success", latencyMs: latency }
              : l
          )
        );
        setTotalSynced((prev) => prev + 1);
        setAvgLatency((prev) => (prev ? Math.round((prev + latency) / 2) : latency));
        playChime();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setLogs((prev) =>
          prev.map((l) =>
            l.id === logId
              ? { ...l, status: "error", error: errJson.error || "Upload failed" }
              : l
          )
        );
      }
    } catch (err: any) {
      setLogs((prev) =>
        prev.map((l) =>
          l.id === logId
            ? { ...l, status: "error", error: err.message || "Network error" }
            : l
        )
      );
    }
  };

  // Scan directory handle for new image files
  const scanDirectory = async () => {
    if (!dirHandleRef.current || isScanningRef.current) return;
    isScanningRef.current = true;

    try {
      const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".arw", ".cr3", ".nef", ".raf"];
      const newFiles: File[] = [];

      // Iterate through files in directory handle
      for await (const entry of dirHandleRef.current.values()) {
        if (entry.kind === "file") {
          const lowerName = entry.name.toLowerCase();
          const isImage = allowedExts.some((ext) => lowerName.endsWith(ext));

          if (isImage && !processedFilesRef.current.has(entry.name)) {
            // Retrieve file object
            const file = await entry.getFile();
            // Verify file has size > 0 and wasn't still being written
            if (file.size > 1024) {
              processedFilesRef.current.add(entry.name);
              newFiles.push(file);
            }
          }
        }
      }

      // Sort chronological by lastModified and upload
      newFiles.sort((a, b) => a.lastModified - b.lastModified);
      for (const f of newFiles) {
        await uploadTetherFile(f);
      }
    } catch (err) {
      console.warn("Folder scan error:", err);
    } finally {
      isScanningRef.current = false;
    }
  };

  // Start watching local folder via File System Access API
  const handleStartWatching = async () => {
    if (!("showDirectoryPicker" in window)) {
      alert(
        "File System Access API is not supported in this browser. Please use Chrome, Edge, or use the Desktop CLI Daemon tab."
      );
      return;
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: "read",
      });

      dirHandleRef.current = handle;
      setFolderName(handle.name);
      setIsWatching(true);

      // Perform initial inventory to avoid re-uploading old historical files if requested
      const existingNames = new Set<string>();
      for await (const entry of handle.values()) {
        if (entry.kind === "file") {
          existingNames.add(entry.name);
        }
      }

      const shouldUploadExisting = window.confirm(
        `Folder "${handle.name}" selected (${existingNames.size} existing files).\n\nDo you want to upload all existing photos to "${selectedEvent?.name}", or only new shots taken from now on?\n\nClick OK for All Existing Photos, or Cancel for Only New Shots.`
      );

      if (!shouldUploadExisting) {
        processedFilesRef.current = existingNames;
      } else {
        processedFilesRef.current.clear();
      }

      // Start rapid 1.5s tether scanner
      await scanDirectory();
      watchTimerRef.current = setInterval(scanDirectory, 1500);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        alert(`Failed to open folder: ${err.message}`);
      }
    }
  };

  // Stop watching
  const handleStopWatching = () => {
    if (watchTimerRef.current) {
      clearInterval(watchTimerRef.current);
      watchTimerRef.current = null;
    }
    dirHandleRef.current = null;
    setIsWatching(false);
  };

  // Manual fallback file drop
  const handleManualDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(jpe?g|png|webp|arw|cr3|nef)$/i.test(f.name)
    );
    files.forEach((f) => uploadTetherFile(f));
  };

  const copyCliCommand = () => {
    const cmd = `node scripts/camera-watcher.mjs --event="${selectedEventId || "sample2"}" --folder="C:\\Photos\\Tether" --key="marvan2026"`;
    navigator.clipboard.writeText(cmd);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <Camera className="w-8 h-8 text-accent animate-pulse" />
              Camera Tethering Hot-Folder
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent border border-accent/30">
              Pro Sony · Canon · Nikon
            </span>
          </div>
          <p className="text-white/60 text-sm mt-1">
            Auto-detect, watermark, and upload photos to the live cloud the second your shutter clicks.
          </p>
        </div>

        {/* Sound toggle & Target Event selector */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-2xl bg-graphite/80 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={soundEnabled ? "Mute Shutter Chime" : "Enable Shutter Chime"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-accent" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {events.length > 0 && (
            <div className="flex items-center gap-2 bg-graphite/80 border border-white/10 px-4 py-2 rounded-2xl">
              <span className="text-xs text-white/50 uppercase tracking-wider font-semibold">Event:</span>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-midnight text-white">
                    {ev.name} ({ev.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Live Status Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Watcher Engine</span>
            <Zap className={`w-4 h-4 ${isWatching ? "text-emerald-400" : "text-white/40"}`} />
          </div>
          <div className="text-xl font-extrabold text-white flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isWatching ? "bg-emerald-400 animate-ping" : "bg-white/30"
              }`}
            />
            {isWatching ? "Live Watching" : "Standby"}
          </div>
          <p className="text-[11px] text-white/40 mt-1 truncate">
            {folderName ? `Watching "${folderName}"` : "No folder attached"}
          </p>
        </GlassCard>

        <GlassCard className="p-4 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Shutter Synced</span>
            <CheckCircle2 className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-black text-accent">{totalSynced}</div>
          <p className="text-[11px] text-white/40 mt-1">Photos pushed to cloud</p>
        </GlassCard>

        <GlassCard className="p-4 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Average Latency</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {avgLatency ? `${avgLatency} ms` : "--"}
          </div>
          <p className="text-[11px] text-white/40 mt-1">Camera → Live Web</p>
        </GlassCard>

        <GlassCard className="p-4 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Active Target</span>
            <FileImage className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white truncate">
            {selectedEvent ? selectedEvent.name : "None"}
          </div>
          {selectedEvent && (
            <Link
              href={`/event/${selectedEvent.id}`}
              target="_blank"
              className="text-[11px] text-accent hover:underline flex items-center gap-1 mt-1"
            >
              Open Live Gallery <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </GlassCard>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab("browser")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "browser"
              ? "bg-accent/20 text-accent border border-accent/30"
              : "text-white/60 hover:text-white"
          }`}
        >
          🌐 In-Browser Hot-Folder (Zero Install)
        </button>
        <button
          onClick={() => setActiveTab("cli")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "cli"
              ? "bg-accent/20 text-accent border border-accent/30"
              : "text-white/60 hover:text-white"
          }`}
        >
          💻 Desktop CLI Daemon (Sony / Lightroom Background)
        </button>
      </div>

      {/* Tab 1: Browser Hot Folder */}
      {activeTab === "browser" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6">
            <GlassCard className="p-6 space-y-5 border-white/15">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-accent" />
                Select Tether Directory
              </h3>

              <p className="text-xs text-white/60 leading-relaxed">
                Choose the local folder where Sony Imaging Edge, Canon EOS Utility, Nikon NX, or Lightroom
                saves incoming tethered shots. The browser will automatically detect and stream new files.
              </p>

              {/* Photographer Info */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-white/50 font-semibold block mb-1">
                    Photographer Credit
                  </label>
                  <input
                    type="text"
                    value={photographerName}
                    onChange={(e) => setPhotographerName(e.target.value)}
                    className="w-full bg-graphite/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-white/50 font-semibold block mb-1">
                    Batch Caption Tag
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full bg-graphite/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Start / Stop Buttons */}
              <div className="pt-2">
                {!isWatching ? (
                  <GlassButton
                    variant="primary"
                    onClick={handleStartWatching}
                    className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(212,183,122,0.3)]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Select Camera Folder & Start Live Sync
                  </GlassButton>
                ) : (
                  <button
                    onClick={handleStopWatching}
                    className="w-full py-3.5 px-4 rounded-2xl bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop Watching Folder
                  </button>
                )}
              </div>
            </GlassCard>

            {/* Manual Drag & Drop Fallback */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleManualDrop}
              className="border-2 border-dashed border-white/20 hover:border-accent/50 rounded-2xl p-6 text-center transition-all bg-white/[0.02]"
            >
              <FileImage className="w-8 h-8 text-white/40 mx-auto mb-2" />
              <p className="text-xs font-semibold text-white">Manual Drag & Drop Staging</p>
              <p className="text-[11px] text-white/40 mt-1">
                Drop RAW / JPG shots directly here to manually inject them into the live cloud stream.
              </p>
            </div>
          </div>

          {/* Live Activity Stream Column */}
          <div className="lg:col-span-7 space-y-4">
            <GlassCard className="p-6 border-white/15 min-h-[460px] flex flex-col">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="text-base font-bold text-white">Real-Time Camera Shutter Feed</h3>
                </div>
                <span className="text-xs text-white/40 font-mono">
                  {logs.length} logged
                </span>
              </div>

              {logs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <Camera className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-semibold text-white">Awaiting Camera Shutter...</p>
                  <p className="text-xs text-white/50 max-w-sm">
                    Select your tether folder. As your camera captures images, they will appear here and
                    stream directly into the live gallery.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
                  <AnimatePresence>
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {log.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={log.previewUrl}
                              alt=""
                              className="w-10 h-10 object-cover rounded-lg border border-white/20 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                              <FileImage className="w-5 h-5 text-white/40" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate max-w-[220px]">
                              {log.filename}
                            </p>
                            <p className="text-[10px] text-white/40">
                              {log.timestamp} {log.sizeKb ? `· ${log.sizeKb} KB` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {log.status === "uploading" && (
                            <span className="flex items-center gap-1.5 text-accent font-semibold">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Syncing...
                            </span>
                          )}
                          {log.status === "success" && (
                            <div className="text-right">
                              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Live ({log.latencyMs}ms)
                              </span>
                            </div>
                          )}
                          {log.status === "error" && (
                            <span className="flex items-center gap-1 text-red-400 font-bold">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {log.error || "Failed"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {/* Tab 2: Desktop CLI Daemon */}
      {activeTab === "cli" && (
        <GlassCard className="p-8 space-y-6 border-white/15">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20 text-accent">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Standalone Desktop Background Watcher</h3>
              <p className="text-xs text-white/60 mt-1">
                Run our ultra-fast background daemon on your laptop during the event. It runs independently
                in PowerShell / Command Prompt without keeping a browser tab open.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-white/50 text-[11px] pb-2 border-b border-white/10">
              <span>Windows PowerShell / Command Prompt</span>
              <button
                onClick={copyCliCommand}
                className="flex items-center gap-1 text-accent hover:text-white transition-colors cursor-pointer"
              >
                {copiedCli ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCli ? "Copied!" : "Copy Command"}
              </button>
            </div>
            <p className="text-accent/90 break-all select-all">
              {`node scripts/camera-watcher.mjs --event="${selectedEventId || "sample2"}" --folder="C:\\Photos\\Tether" --key="marvan2026"`}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/70">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
              <span className="font-bold text-white block">1. Connect Camera</span>
              <p className="text-white/50 text-[11px]">
                Tether your Sony, Canon, or Nikon via USB-C to your laptop. Set destination folder.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
              <span className="font-bold text-white block">2. Run Watcher Script</span>
              <p className="text-white/50 text-[11px]">
                Paste the command into terminal or double-click `start-camera-watcher.bat`.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
              <span className="font-bold text-white block">3. Instant Live Cloud</span>
              <p className="text-white/50 text-[11px]">
                Every photo instantly uploads to the live gallery with your luxury bottom-center signature watermark.
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
