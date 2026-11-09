"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { X, Sparkles, Upload, Loader2, Image as ImageIcon } from "lucide-react";
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
  onSave: (data: EventFormData) => void;
  initialData?: Event | null;
  title: string;
}

// Client-side downscaler to optimize event cover photos into lightweight thumbnails (~50-80KB)
async function createCoverThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 800;
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
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          "image/jpeg",
          0.8
        );
      } else {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const optimizedBlob = await createCoverThumbnail(file);
      const data = new FormData();
      data.append("files", optimizedBlob, file.name.replace(/\.[^.]+$/, ".jpg"));
      data.append("guestName", "Event Cover");
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
        const uploadedUrl = result.files?.[0]?.url;
        if (uploadedUrl) {
          setFormData((prev) => ({ ...prev, coverUrl: uploadedUrl }));
        }
      }
    } catch (err) {
      console.error("Cover upload failed", err);
    } finally {
      setUploadingCover(false);
    }
  };

  useEffect(() => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg z-10"
        >
          <GlassCard className="p-6 md:p-8 rounded-3xl border-white/20 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> {title}
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-semibold text-accent mb-1 tracking-wider">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-accent mb-1 tracking-wider">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-accent mb-1 tracking-wider">
                    Custom Code
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
                  <label className="block text-xs uppercase font-semibold text-accent mb-1 tracking-wider flex items-center justify-between">
                    <span>VIP Security PIN</span>
                    <span className="text-[10px] text-white/50 lowercase">optional</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin || ""}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.trim() })}
                    placeholder="e.g. 2026 (Locks gallery)"
                    className="w-full bg-graphite border border-accent/40 rounded-xl px-4 py-2.5 text-sm text-accent focus:outline-none focus:border-accent font-mono tracking-widest placeholder:text-white/30 placeholder:tracking-normal"
                  />
                </div>
              </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-semibold text-accent mb-1 tracking-wider">
                  Location *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-graphite border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                  placeholder="e.g. Rosewood Estate, Napa Valley"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-semibold text-accent mb-1 tracking-wider">
                  Event Cover Photo Thumbnail
                </label>
                <div className="flex flex-col gap-2">
                  {formData.coverUrl && (
                    <div className="relative aspect-[16/9] w-full max-h-36 rounded-xl overflow-hidden bg-black/60 border border-white/10 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.coverUrl}
                        alt="Event Cover Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, coverUrl: "" }))}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white/80 hover:text-white hover:bg-black/90 transition-colors"
                        title="Remove cover image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition-colors">
                      {uploadingCover ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-accent" /> Upload Image
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
                      type="url"
                      value={formData.coverUrl}
                      onChange={(e) => setFormData({ ...formData, coverUrl: e.target.value })}
                      className="flex-1 bg-graphite border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                      placeholder="Or paste photo URL..."
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-semibold text-accent mb-1 tracking-wider">
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

              <div className="flex justify-end gap-3 pt-4">
                <GlassButton variant="ghost" type="button" onClick={onClose}>
                  Cancel
                </GlassButton>
                <GlassButton variant="primary" type="submit">
                  Save Event
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
