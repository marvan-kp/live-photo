"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { useState, useRef, DragEvent } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  maxFiles?: number;
}

export const UploadZone = ({ onUpload, maxFiles = 20 }: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(
      (file) => file.type.startsWith('image/')
    );
    if (files.length + validFiles.length > maxFiles) {
      // Show warning
      return;
    }
    setFiles((prev) => [...prev, ...validFiles]);
    onUpload(validFiles);
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <GlassCard className="p-8 rounded-3xl border-white/20 relative overflow-hidden">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative h-64 md:h-96 flex flex-col items-center justify-center",
          "border-2 border-dashed border-white/30 rounded-2xl",
          "transition-all duration-300",
          isDragging && "scale-105 border-accent/50",
          files.length > 0 && "h-auto min-h-[200px]"
        )}
      >
        {files.length === 0 ? (
          <>
            <Upload className="w-16 h-16 text-white/60 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Drag & Drop Photos</h3>
            <p className="text-white/60 text-sm">or click to upload</p>
            <p className="text-xs text-white/40 mt-2">PNG, JPG, WebP up to 20 files</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 w-full">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden bg-black"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight via-transparent to-transparent" />
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute top-2 right-2 p-1 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <span className="text-sm text-white/60">{files.length} files selected</span>
              <GlassButton
                variant="secondary"
                onClick={() => {
                  setFiles([]);
                  onUpload([]);
                }}
                className="text-xs px-4 py-2"
              >
                Clear All
              </GlassButton>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
};
