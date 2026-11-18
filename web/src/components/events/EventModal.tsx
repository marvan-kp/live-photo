"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { X, Sparkles, Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Event } from "@/lib/events";

export type EventFormData = {
  name: string;
  date: string;
  location: string;
  coverUrl: string;
  description?: string;
  code?: string;
  pin?: string;
};

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void> | void;
  initialData?: Event | null;
  title: string;
}

// Client-side optimizer: creates a lightweight JPEG blob + dataUrl thumbnail (~40-70KB)
async function createCoverThumbnail(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 900;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Fill dark backdrop first so transparent PNG cutouts don't look jarring
        ctx.fillStyle = "#101116";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        canvas.toBlob(
          (blob) => {
            resolve({ blob: blob || file, dataUrl });
          },
          "image/jpeg",
          0.8
        );
      } else {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ blob: file, dataUrl: String(reader.result || "") });
        reader.readAsDataURL(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onloadend = () => resolve({ blob: file, dataUrl: String(reader.result || "") });
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

export const EventModal = ({ isOpen, onClose, onSave, initialData, title }: EventModalProps) => {
  const [formData, setFormData] = useState<EventFormData>({
    name: "",
    date: "",
    location: "",
    coverUrl: "",
    description: "",
    code: "",
    pin: "",
  });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverStatus, setCoverStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    setCoverStatus(null);
    setErrorMsg(null);

    try {
      const { blob, dataUrl } = await createCoverThumbnail(file);

      // Show immediate instant preview while uploading
      if (dataUrl) {
        setFormData((prev) => ({ ...prev, coverUrl: dataUrl }));
      }

      const data = new FormData();
      data.append("files", blob, file.name.replace(/\.[^.]+$/, ".jpg"));
      data.append("guestName", "Event Cover");
      data.append("bypassCulling", "true");
      data.append("watermarkEnabled", "false");
      data.append("adminKey", "marvan2026");

      const res = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "x-admin-key": "marvan2026",
        },
        body: data,
      });

      if (res.ok) {
        const result = await res.json();
        const uploadedUrl: string | undefined = result.files?.[0]?.url;
        if (uploadedUrl && uploadedUrl.startsWith("http")) {
          // Permanent Cloud CDN URL (Vercel Blob / Supabase / Cloudflare R2)
          setFormData((prev) => ({ ...prev, coverUrl: uploadedUrl }));
          setCoverStatus("Uploaded to permanent Cloud CDN");
        } else if (dataUrl) {
          // Keep embedded compact thumbnail so cover never breaks on serverless cold-start
          setFormData((prev) => ({ ...prev, coverUrl: dataUrl }));
          setCoverStatus("Thumbnail optimized & ready");
        } else if (uploadedUrl) {
          setFormData((prev) => ({ ...prev, coverUrl: uploadedUrl }));
          setCoverStatus("Thumbnail uploaded");
        }
      } else {
        // Still keep client-optimized thumbnail if server returned non-OK
        if (dataUrl) {
          setCoverStatus("Thumbnail optimized locally & ready to save");
        } else {
          setErrorMsg("Cover photo upload failed. Please try another image.");
        }
      }
    } catch (err) {
      console.error("Cover upload failed", err);
      setErrorMsg("Could not process cover image.");
    } finally {
      setUploadingCover(false);
      // Reset input so re-selecting the same file works
      e.target.value = "";
    }
  };

  useEffect(() => {
    setErrorMsg(null);
    setCoverStatus(null);
    setSaving(false);
    if (initialData) {
      setFormData({
        name: initialData.name,
        date: initialData.date,
        location: initialData.location,
        coverUrl: initialData.coverUrl,
        description: initialData.description || "",
        code: initialData.code || "",
        pin: initialData.pin || "",
      });
    } else {
      setFormData({
        name: "",
        date: new Date().toISOString().split("T")[0],
        location: "",
        coverUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200",
        description: "",
        code: "",
        pin: "",
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.name.trim() || !formData.date.trim() || !formData.location.trim()) {
      setErrorMsg("Please fill in Event Name, Date, and Location.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        name: formData.name.trim(),
        location: formData.location.trim(),
        code: formData.code?.trim().toUpperCase() || "",
        pin: formData.pin?.trim() || "",
        description: formData.description?.trim() || "",
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save event. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
          onClick={onClose}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg z-10 my-8"
        >
          <GlassCard className="p-6 md:p-8 rounded-3xl border-white/20 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase font-semibold text-accent mb-1.5 tracking-wider">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                  placeholder="e.g. Sarah & Alex Wedding"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-accent mb-1.5 tracking-wider">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-semibold text-accent mb-1.5 tracking-wider">
                    Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                    placeholder="e.g. Grand Ballroom, Kochi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-accent mb-1.5 tracking-wider">
                    Custom Code <span className="text-[10px] text-white/40 lowercase font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WED26"
                    className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-semibold text-accent mb-1.5 tracking-wider">
                    VIP Security PIN <span className="text-[10px] text-white/40 lowercase font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin || ""}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.trim() })}
                    placeholder="e.g. 2026"
                    className="w-full bg-graphite border border-accent/40 rounded-xl px-4 py-2.5 text-sm text-accent focus:outline-none focus:border-accent font-mono tracking-widest placeholder:text-white/30 placeholder:tracking-normal"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs uppercase font-semibold text-accent tracking-wider">
                    Event Cover Photo Thumbnail
                  </label>
                  {coverStatus && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {coverStatus}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {formData.coverUrl && (
                    <div className="relative aspect-[16/9] w-full max-h-40 rounded-xl overflow-hidden bg-black/60 border border-white/15 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.coverUrl}
                        alt="Event Cover Preview"
                        className="w-full h-full object-cover object-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, coverUrl: "" }));
                          setCoverStatus(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/75 text-white/80 hover:text-white hover:bg-black/95 transition-colors border border-white/10"
                        title="Remove cover image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-xs font-semibold text-accent transition-colors flex-shrink-0">
                      {uploadingCover ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" /> Upload Image
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverUpload}
                        disabled={uploadingCover}
                      />
                    </label>

                    <input
                      type="text"
                      value={formData.coverUrl.startsWith("data:image/") ? "(Uploaded thumbnail attached)" : formData.coverUrl}
                      onChange={(e) => {
                        setCoverStatus(null);
                        setFormData({ ...formData, coverUrl: e.target.value });
                      }}
                      className="flex-1 bg-graphite border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-accent"
                      placeholder="Or paste photo URL..."
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-semibold text-accent mb-1.5 tracking-wider">
                  Description / Welcome Message
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  placeholder="Welcome! Scan the QR to share your photos live."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <GlassButton variant="ghost" type="button" onClick={onClose} disabled={saving}>
                  Cancel
                </GlassButton>
                <GlassButton
                  variant="primary"
                  type="submit"
                  disabled={saving || uploadingCover}
                  className="min-w-[130px] flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Event"
                  )}
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
