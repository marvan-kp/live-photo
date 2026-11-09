"use client";

import { useEffect, useState } from "react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { UploadZone } from "@/components/upload/UploadZone";
import { Loader2, CheckCircle2, Tv, ExternalLink } from "lucide-react";
import Link from "next/link";

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
  const [uploadSuccessCount, setUploadSuccessCount] = useState<number | null>(null);

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

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    if (selectedEventId) formData.append("eventId", selectedEventId);
    if (photographerName) formData.append("guestName", photographerName);
    if (batchCaption) formData.append("caption", batchCaption);
    formData.append("adminKey", "marvan2026");

    if (typeof window !== "undefined") {
      const savedWm = localStorage.getItem("livephoto_watermark_config");
      if (savedWm) {
        try {
          const parsed = JSON.parse(savedWm);
          if (parsed.position) formData.append("watermarkPosition", parsed.position);
          if (parsed.scale) formData.append("watermarkScale", String(parsed.scale));
          if (parsed.opacity) formData.append("watermarkOpacity", String(parsed.opacity));
          if (parsed.enabled !== undefined) formData.append("watermarkEnabled", String(parsed.enabled));
        } catch (_) {}
      }
    }

    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "x-admin-key": "marvan2026",
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadSuccessCount(data.count || files.length);
        setFiles([]);
      } else {
        const errJson = await response.json().catch(() => ({}));
        alert(errJson.error || "Upload failed. Please check file sizes or formats.");
      }
    } catch (error) {
      alert("Error uploading files.");
    } finally {
      setIsUploading(false);
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
