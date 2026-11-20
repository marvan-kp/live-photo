"use client";

import { useEffect, useState } from "react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { UploadZone } from "@/components/upload/UploadZone";
import { Loader2, CheckCircle2, Tv, ExternalLink, AlertCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { uploadPhotosIndividually } from "@/lib/clientUpload";

interface Event {
  id: string;
  code: string;
  name: string;
}

export default function UploadPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [photographerName, setPhotographerName] = useState<string>("Official Photographer");
  const [batchCaption, setBatchCaption] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => {
        const evList: Event[] = d.events || [];
        setEvents(evList);
        if (evList.length > 0) setSelectedEventId(evList[0].id);
      })
      .catch((e) => console.error(e));
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadSuccessCount(null);
    setUploadErrors([]);
    setUploadProgress({ current: 0, total: files.length, currentFileName: files[0]?.name || "" });

    try {
      const result = await uploadPhotosIndividually(files, {
        eventId: selectedEventId,
        guestName: photographerName.trim() || "Official Photographer",
        caption: batchCaption.trim(),
        onProgress: (completed, total, currentFile) => {
          setUploadProgress({ current: completed, total, currentFileName: currentFile });
        },
      });

      if (result.uploadedFiles.length > 0) {
        setUploadSuccessCount(result.uploadedFiles.length);
        setFiles([]);
      }

      if (result.errors.length > 0) {
        setUploadErrors(result.errors);
      }
    } catch (error: any) {
      setUploadErrors([error?.message || "Error uploading files."]);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold text-white">Upload Photos to Live Stream</h2>
        <p className="text-white/60 text-sm">
          Upload official event photos or bulk guest images directly into any event gallery.
        </p>
      </div>

      <GlassCard className="p-6 rounded-3xl border-white/15 space-y-6">
        {/* Destination Event Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase font-semibold text-accent tracking-wider">Target Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-midnight text-white">
                  {ev.name} ({ev.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-semibold text-accent tracking-wider">Uploader / Tag</label>
            <input
              type="text"
              value={photographerName}
              onChange={(e) => setPhotographerName(e.target.value)}
              placeholder="e.g. Host, Pro Camera"
              className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-semibold text-accent tracking-wider">Batch Caption</label>
            <input
              type="text"
              value={batchCaption}
              onChange={(e) => setBatchCaption(e.target.value)}
              placeholder="e.g. Ceremony Highlights"
              className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <UploadZone onUpload={setFiles} />

        {/* Live Upload Progress */}
        {uploadProgress && (
          <div className="p-4 rounded-2xl bg-accent/10 border border-accent/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-accent flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing {uploadProgress.current + 1} of {uploadProgress.total}
              </span>
              <span className="text-white/60 font-mono">
                {Math.round(((uploadProgress.current) / uploadProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.max(5, Math.round(((uploadProgress.current) / uploadProgress.total) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-white/50 truncate">
              Optimizing & uploading: {uploadProgress.currentFileName || "Completing batch..."}
            </p>
          </div>
        )}

        {/* Errors Callout if any */}
        {uploadErrors.length > 0 && (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Some files could not be uploaded:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-red-300/80 pl-2">
              {uploadErrors.map((err, idx) => (
                <li key={idx} className="truncate">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-white/50">
            {files.length > 0 ? `${files.length} photo(s) selected` : "No photos chosen"}
          </span>

          <div className="flex gap-4">
            {files.length > 0 && (
              <GlassButton variant="ghost" onClick={() => setFiles([])} disabled={isUploading}>
                Clear
              </GlassButton>
            )}
            <GlassButton
              variant="primary"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className="px-6 py-2.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                </>
              ) : (
                `Upload ${files.length > 0 ? `(${files.length})` : ""}`
              )}
            </GlassButton>
          </div>
        </div>

        {/* Upload Success Callout */}
        {uploadSuccessCount !== null && selectedEvent && (
          <div className="p-4 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-300 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span>
                Successfully uploaded {uploadSuccessCount} photo(s) to <strong>{selectedEvent.name}</strong>!
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/event/${selectedEvent.id}`} target="_blank">
                <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> View Gallery
                </button>
              </Link>
              <Link href={`/event/${selectedEvent.id}/live`} target="_blank">
                <button className="px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-bold flex items-center gap-1.5 hover:bg-accent/90 transition-colors">
                  <Tv className="w-3.5 h-3.5" /> Open Projector
                </button>
              </Link>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
