"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassNavbar } from "@/components/ui/GlassNavbar";
import { generateQRCodeDataUrl } from "@/lib/qrcode";
import {
  Download,
  Smartphone,
  ShieldCheck,
  Zap,
  Camera,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  QrCode
} from "lucide-react";
import Link from "next/link";

export default function DownloadPage() {
  const [apkQrUrl, setApkQrUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const downloadUrl = `${window.location.origin}/apk/live-photo-share.apk`;
      generateQRCodeDataUrl(downloadUrl, { width: 300, margin: 2 }).then(setApkQrUrl);
    }
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden pb-20">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[160px] pointer-events-none" />

      <GlassNavbar />

      <div className="pt-36 max-w-5xl mx-auto px-6 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Signature by Marvan"
            className="h-20 w-auto object-contain filter drop-shadow-[0_4px_16px_rgba(212,183,122,0.4)] mb-2"
          />
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider">
            <Smartphone className="w-4 h-4" /> Official Android Release
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Get <span className="text-gradient">Signature by Marvan</span> for Android
          </h1>
          <p className="text-white/60 text-base md:text-lg">
            Direct APK download for event hosts and guests. Real-time sync with website, live photo capture, and AI face recognition.
          </p>
        </div>

        {/* Download Main Card */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column: Direct Download Details */}
          <div className="md:col-span-7 space-y-6">
            <GlassCard className="p-8 rounded-3xl border-white/20 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Signature by Marvan APK</h3>
                  <p className="text-sm text-accent font-semibold">Version 1.0.0 (Release Build)</p>
                </div>
                <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold border border-green-500/30">
                  Ready to Install
                </div>
              </div>

              <div className="space-y-3 text-sm text-white/70">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Instant QR Code Scanner & Event Discovery</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Live background photo syncing with auto-retry</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Pro camera controls: burst, focus, and scene modes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>Supports Sony, Canon, Nikon & mobile cameras</span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="/apk/live-photo-share.apk"
                  download="live-photo-share.apk"
                  className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-accent hover:bg-accent/90 text-black font-extrabold text-base tracking-wide transition-all shadow-xl hover:scale-[1.02] active:scale-98"
                >
                  <Download className="w-5 h-5" /> Download Android APK (Direct)
                </a>
                <p className="text-center text-xs text-white/40 mt-3">
                  Package: <code className="text-white/60">com.livephotoshare.app</code> • Android 7.0+ (API 24+)
                </p>
              </div>
            </GlassCard>
          </div>

          {/* Right Column: Scan to Download on Phone */}
          <div className="md:col-span-5">
            <GlassCard className="p-8 rounded-3xl border-white/20 text-center space-y-4 shadow-2xl flex flex-col items-center">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Scan with your phone</span>
              <h4 className="text-lg font-bold text-white">Download Directly on Mobile</h4>

              <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-accent/20">
                {apkQrUrl ? (
                  <img src={apkQrUrl} alt="Download QR" className="w-48 h-48 object-contain" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-black/40 text-xs">
                    Generating QR...
                  </div>
                )}
              </div>

              <p className="text-xs text-white/50 max-w-xs">
                Point your phone camera at this QR code to download and install the APK directly on your device.
              </p>
            </GlassCard>
          </div>
        </div>

        {/* 3 Simple Steps to Install */}
        <div className="space-y-6 pt-4">
          <h3 className="text-2xl font-bold text-white text-center">How to Install in 3 Easy Steps</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="p-6 rounded-2xl border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">1</div>
              <h4 className="font-bold text-white">Download APK</h4>
              <p className="text-xs text-white/60">
                Tap the download button above or scan the QR code with your Android phone.
              </p>
            </GlassCard>

            <GlassCard className="p-6 rounded-2xl border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">2</div>
              <h4 className="font-bold text-white">Allow Unknown Apps</h4>
              <p className="text-xs text-white/60">
                If prompted by Android, tap <strong>Settings</strong> and switch on <em>"Allow from this source"</em> for your browser.
              </p>
            </GlassCard>

            <GlassCard className="p-6 rounded-2xl border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">3</div>
              <h4 className="font-bold text-white">Open & Share</h4>
              <p className="text-xs text-white/60">
                Tap <strong>Install</strong>, then open the app. Scan any event QR code to join and start uploading!
              </p>
            </GlassCard>
          </div>
        </div>
      </div>
    </main>
  );
}
