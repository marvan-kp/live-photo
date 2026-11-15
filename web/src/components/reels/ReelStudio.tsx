"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  Clapperboard,
  Play,
  Square,
  Download,
  Sparkles,
  Music,
  Volume2,
  VolumeX,
  Check,
  ArrowUp,
  ArrowDown,
  Loader2,
  Share2,
  RefreshCw,
  Wand2,
  Heart,
  Sliders,
  Film,
  Upload,
} from "lucide-react";

export interface ReelPhotoItem {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  proxyUrl?: string;
  guestName?: string;
  caption?: string;
  likes: number;
  qualityScore?: number;
  highlightScore?: number;
  createdAt: string;
}

export interface ReelEventItem {
  id: string;
  code: string;
  name: string;
  date: string;
  location: string;
  coverUrl?: string;
  pin?: string;
}

type ReelTemplate = "signature-gold" | "editorial-minimal" | "cinema-noir";
type TransitionType = "crossfade" | "slide" | "zoom";
type AudioMode = "synth-pad" | "custom" | "silent";

interface ReelStudioProps {
  initialEventId?: string;
  mode?: "studio" | "event";
}

interface LoadedSlide {
  photo: ReelPhotoItem;
  img: HTMLImageElement;
}

const CANVAS_W = 1080;
const CANVAS_H = 1920;

function createSafeMediaRecorder(
  stream: MediaStream
): { recorder: MediaRecorder; mimeType: string; ext: "mp4" | "webm" } {
  const candidates: { mime: string; ext: "mp4" | "webm" }[] = [
    { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];

  for (const c of candidates) {
    if (typeof MediaRecorder.isTypeSupported === "function" && !MediaRecorder.isTypeSupported(c.mime)) {
      continue;
    }
    try {
      const rec = new MediaRecorder(stream, {
        mimeType: c.mime,
        videoBitsPerSecond: 6_500_000,
      });
      return { recorder: rec, mimeType: rec.mimeType || c.mime, ext: c.ext };
    } catch (_) {
      // Try next supported codec/container combination
    }
  }

  const fallbackRec = new MediaRecorder(stream);
  const detectedMime = fallbackRec.mimeType || "video/webm";
  const detectedExt: "mp4" | "webm" = detectedMime.includes("mp4") ? "mp4" : "webm";
  return { recorder: fallbackRec, mimeType: detectedMime, ext: detectedExt };
}

function loadCorsImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  scale = 1,
  panX = 0,
  panY = 0
) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const targetRatio = dw / dh;
  const imgRatio = iw / ih;

  let drawW = dw;
  let drawH = dh;
  if (imgRatio > targetRatio) {
    drawH = dh * scale;
    drawW = drawH * imgRatio;
  } else {
    drawW = dw * scale;
    drawH = drawW / imgRatio;
  }

  const x = dx + (dw - drawW) / 2 + panX;
  const y = dy + (dh - drawH) / 2 + panY;
  ctx.drawImage(img, x, y, drawW, drawH);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
): number {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) {
    lines.push(line);
  }
  lines.forEach((l, idx) => {
    ctx.fillText(l, cx, startY + idx * lineHeight);
  });
  return startY + lines.length * lineHeight;
}

export function ReelStudio({ initialEventId, mode = "studio" }: ReelStudioProps) {
  const [events, setEvents] = useState<ReelEventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || "");
  const [activeEvent, setActiveEvent] = useState<ReelEventItem | null>(null);
  const [allPhotos, setAllPhotos] = useState<ReelPhotoItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<"highlights" | "newest" | "all">("highlights");

  // Studio Styling Controls
  const [template, setTemplate] = useState<ReelTemplate>("signature-gold");
  const [transition, setTransition] = useState<TransitionType>("crossfade");
  const [slideSeconds, setSlideSeconds] = useState<number>(2.2);
  const [showIntro, setShowIntro] = useState(true);
  const [showOutro, setShowOutro] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [showCredits, setShowCredits] = useState(true);
  const [customTitle, setCustomTitle] = useState("");

  // Audio Controls
  const [audioMode, setAudioMode] = useState<AudioMode>("synth-pad");
  const [customAudioName, setCustomAudioName] = useState<string>("");
  const [mutePreview, setMutePreview] = useState(false);

  // Runtime Playback & Recording State
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Ready to preview or export 1080×1920 9:16 Reel");
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedExt, setExportedExt] = useState<"mp4" | "webm">("webm");
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [canShare, setCanShare] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStopRef = useRef<(() => void) | null>(null);
  const customAudioFileRef = useRef<ArrayBuffer | null>(null);
  const loadedSlidesRef = useRef<LoadedSlide[]>([]);
  const wmImageRef = useRef<HTMLImageElement | null>(null);

  // Fetch Reel photos & events
  const loadReelData = async (evId?: string, sort = sortMode) => {
    setLoading(true);
    try {
      const targetEv = evId !== undefined ? evId : selectedEventId;
      const qs = new URLSearchParams();
      if (targetEv) qs.set("eventId", targetEv);
      qs.set("sort", sort);

      const res = await fetch(`/api/reels?${qs.toString()}&_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const evList: ReelEventItem[] = data.events || [];
        setEvents(evList);
        if (!targetEv && evList.length > 0 && !selectedEventId) {
          setSelectedEventId(evList[0].id);
        }
        setActiveEvent(data.event || evList[0] || null);
        const list: ReelPhotoItem[] = data.photos || [];
        setAllPhotos(list);
        // Auto-pick top 8 highest-scoring photos by default
        setSelectedIds(list.slice(0, Math.min(8, list.length)).map((p) => p.id));
      }
    } catch (e) {
      console.error("Failed loading reel studio data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    loadReelData(initialEventId || undefined, sortMode);
    // Load static idle canvas preview after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEventId]);

  useEffect(() => {
    return () => {
      stopPlaybackAndAudio();
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderedSelectedPhotos: ReelPhotoItem[] = selectedIds
    .map((id) => allPhotos.find((p) => p.id === id))
    .filter((p): p is ReelPhotoItem => Boolean(p));

  const introMs = showIntro ? 1800 : 0;
  const outroMs = showOutro ? 2000 : 0;
  const slideMs = Math.round(slideSeconds * 1000);
  const transMs = Math.min(480, Math.round(slideMs * 0.25));
  const totalDurationMs =
    introMs + Math.max(1, orderedSelectedPhotos.length) * slideMs + outroMs;

  // Preload static preview when selection/template updates while idle
  useEffect(() => {
    if (isPlaying || isExporting || orderedSelectedPhotos.length === 0) return;
    let cancelled = false;
    (async () => {
      const firstPhoto = orderedSelectedPhotos[0];
      const [firstImg, wmImg] = await Promise.all([
        loadCorsImage(firstPhoto.proxyUrl || `/api/reels/image?id=${encodeURIComponent(firstPhoto.id)}`),
        loadCorsImage("/api/reels/image?asset=watermark"),
      ]);
      if (cancelled || !firstImg) return;
      wmImageRef.current = wmImg;
      loadedSlidesRef.current = [{ photo: firstPhoto, img: firstImg }];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Draw first slide (just after intro if enabled, so photo is immediately visible!)
      renderFrame(ctx, loadedSlidesRef.current, wmImg, activeEvent, introMs + 250);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderedSelectedPhotos.map((p) => p.id).join(","),
    template,
    showCredits,
    showWatermark,
    customTitle,
    activeEvent?.id,
  ]);

  const stopPlaybackAndAudio = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (audioStopRef.current) {
      try {
        audioStopRef.current();
      } catch (_) {}
      audioStopRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      try {
        audioCtxRef.current.close();
      } catch (_) {}
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setIsExporting(false);
  };

  // Start procedural Web Audio soundtrack or custom file mixed for recording/preview
  const startAudioEngine = async (
    connectSpeakers: boolean,
    connectRecorder: boolean,
    durationSec: number
  ): Promise<MediaStream | null> => {
    if (audioMode === "silent") return null;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.28;

    const dest = ctx.createMediaStreamDestination();
    if (connectRecorder) {
      masterGain.connect(dest);
    }
    if (connectSpeakers && !mutePreview) {
      masterGain.connect(ctx.destination);
    }

    const stopHandles: (() => void)[] = [];

    if (audioMode === "custom" && customAudioFileRef.current) {
      try {
        const cloned = customAudioFileRef.current.slice(0);
        const audioBuf = await ctx.decodeAudioData(cloned);
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.loop = true;

        const env = ctx.createGain();
        const now = ctx.currentTime;
        env.gain.setValueAtTime(0.01, now);
        env.gain.linearRampToValueAtTime(1.0, now + 0.8);
        if (durationSec > 1.2) {
          env.gain.setValueAtTime(1.0, now + durationSec - 1.0);
          env.gain.linearRampToValueAtTime(0.01, now + durationSec);
        }

        src.connect(env);
        env.connect(masterGain);
        src.start(now);
        stopHandles.push(() => {
          try {
            src.stop();
          } catch (_) {}
        });
      } catch (e) {
        console.warn("Custom audio decode failed, falling back to warm pad:", e);
      }
    } else {
      // Built-in Celestial Gold Synth Pad (Cmaj9 -> Fmaj7 -> Am9 -> G6 chord cycle)
      const chords = [
        [261.63, 329.63, 392.0, 493.88, 587.33],
        [174.61, 261.63, 329.63, 440.0, 523.25],
        [220.0, 261.63, 329.63, 493.88, 659.25],
        [196.0, 246.94, 329.63, 440.0, 587.33],
      ];

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 980;
      filter.Q.value = 0.7;
      filter.connect(masterGain);

      let chordIdx = 0;
      const playChord = () => {
        if (!audioCtxRef.current || ctx.state === "closed") return;
        const notes = chords[chordIdx % chords.length];
        chordIdx++;
        const now = ctx.currentTime;
        for (const freq of notes) {
          const osc = ctx.createOscillator();
          const oscSub = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          oscSub.type = "triangle";
          oscSub.frequency.setValueAtTime(freq * 1.003, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.11, now + 0.65);
          gain.gain.exponentialRampToValueAtTime(0.06, now + 2.2);
          gain.gain.linearRampToValueAtTime(0.0001, now + 2.75);

          osc.connect(gain);
          oscSub.connect(gain);
          gain.connect(filter);

          osc.start(now);
          oscSub.start(now);
          osc.stop(now + 2.8);
          oscSub.stop(now + 2.8);
        }
      };

      playChord();
      const timer = window.setInterval(playChord, 2500);
      stopHandles.push(() => window.clearInterval(timer));
    }

    audioStopRef.current = () => {
      stopHandles.forEach((fn) => fn());
    };

    return dest.stream;
  };

  // Frame renderer at any timestamp tMs in [0, totalDurationMs]
  const renderFrame = (
    ctx: CanvasRenderingContext2D,
    slides: LoadedSlide[],
    wmImg: HTMLImageElement | null,
    ev: ReelEventItem | null,
    tMs: number
  ) => {
    ctx.save();
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Base dark canvas
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#0A0B10");
    bgGrad.addColorStop(0.5, "#11131B");
    bgGrad.addColorStop(1, "#07080C");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (slides.length === 0) {
      ctx.fillStyle = "#D4B77A";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Select Photos to Generate Reel", CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
      return;
    }

    const slidesTotalMs = slides.length * slideMs;
    const outroStartMs = introMs + slidesTotalMs;

    // 1. Render Opening Title Card
    if (showIntro && tMs < introMs) {
      const p = Math.min(1, tMs / introMs);
      const coverSlide = slides[0].img;

      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.4) * 0.42;
      if ("filter" in ctx) ctx.filter = "blur(26px) brightness(0.65)";
      drawImageCover(ctx, coverSlide, 0, 0, CANVAS_W, CANVAS_H, 1.12 + p * 0.06);
      ctx.restore();

      const vig = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 160, CANVAS_W / 2, CANVAS_H / 2, 1100);
      vig.addColorStop(0, "rgba(10,12,18,0.45)");
      vig.addColorStop(1, "rgba(5,6,10,0.94)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Gold decorative frame
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.8);
      ctx.strokeStyle = "rgba(212, 183, 122, 0.55)";
      ctx.lineWidth = 3;
      drawRoundedRect(ctx, 72, 140, CANVAS_W - 144, CANVAS_H - 280, 44);
      ctx.stroke();

      // Header kicker
      ctx.fillStyle = "#D4B77A";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✦  LIVE HIGHLIGHTS REEL  ✦", CANVAS_W / 2, 710);

      // Event Title
      const titleText = customTitle.trim() || ev?.name || "Signature by Marvan";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 74px Georgia, serif";
      const nextY = drawWrappedText(ctx, titleText, CANVAS_W / 2, 830, 820, 92, 3);

      // Date & Location
      if (ev) {
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "500 32px sans-serif";
        ctx.fillText(`${ev.date}   •   ${ev.location}`, CANVAS_W / 2, nextY + 54);
      }

      if (showWatermark && wmImg) {
        const targetW = 340;
        const targetH = (wmImg.naturalHeight / (wmImg.naturalWidth || 1)) * targetW;
        ctx.drawImage(wmImg, (CANVAS_W - targetW) / 2, nextY + 135, targetW, targetH);
      }
      ctx.restore();
      ctx.restore();
      return;
    }

    // 2. Render Closing Studio Outro Card
    if (showOutro && tMs >= outroStartMs) {
      const p = Math.min(1, (tMs - outroStartMs) / outroMs);
      const lastSlide = slides[slides.length - 1].img;

      ctx.save();
      ctx.globalAlpha = 0.35;
      if ("filter" in ctx) ctx.filter = "blur(30px) brightness(0.55)";
      drawImageCover(ctx, lastSlide, 0, 0, CANVAS_W, CANVAS_H, 1.18 - p * 0.05);
      ctx.restore();

      const vig = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 120, CANVAS_W / 2, CANVAS_H / 2, 1080);
      vig.addColorStop(0, "rgba(15,17,24,0.65)");
      vig.addColorStop(1, "rgba(4,5,9,0.96)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 2.0);
      ctx.strokeStyle = "#D4B77A";
      ctx.lineWidth = 3;
      drawRoundedRect(ctx, 84, 180, CANVAS_W - 168, CANVAS_H - 360, 48);
      ctx.stroke();

      if (wmImg) {
        const targetW = 440;
        const targetH = (wmImg.naturalHeight / (wmImg.naturalWidth || 1)) * targetW;
        ctx.drawImage(wmImg, (CANVAS_W - targetW) / 2, 740 - targetH / 2, targetW, targetH);
      } else {
        ctx.fillStyle = "#D4B77A";
        ctx.font = "italic bold 72px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText("Signature by Marvan", CANVAS_W / 2, 760);
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Scan Event QR to Download Full HD", CANVAS_W / 2, 990);

      if (ev?.code) {
        ctx.fillStyle = "#D4B77A";
        ctx.font = "bold 32px monospace";
        ctx.fillText(`EVENT CODE: ${ev.code}`, CANVAS_W / 2, 1065);
      }

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "500 26px sans-serif";
      ctx.fillText(`${slides.length} Curated Moments  •  AI Highlights Edition`, CANVAS_W / 2, 1140);
      ctx.restore();
      ctx.restore();
      return;
    }

    // 3. Render Main Photo Slides + Smooth Transitions
    const localMs = Math.max(0, tMs - introMs);
    const slideIdx = Math.min(slides.length - 1, Math.floor(localMs / slideMs));
    const slideElapsed = localMs - slideIdx * slideMs;
    const slideProgress = Math.min(1, slideElapsed / slideMs);

    const drawSingleSlide = (idx: number, prog: number, alpha: number, xOffset = 0) => {
      const { img, photo } = slides[idx];
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(xOffset, 0);

      const zoomDir = idx % 2 === 0 ? 1 : -1;
      const kenScale = zoomDir > 0 ? 1.0 + prog * 0.09 : 1.09 - prog * 0.09;
      const panX = (idx % 3 === 0 ? 1 : -1) * (prog - 0.5) * 28;

      if (template === "editorial-minimal") {
        // Full-bleed crisp 9:16
        drawImageCover(ctx, img, 0, 0, CANVAS_W, CANVAS_H, kenScale, panX, 0);
        const scrim = ctx.createLinearGradient(0, CANVAS_H * 0.6, 0, CANVAS_H);
        scrim.addColorStop(0, "rgba(0,0,0,0)");
        scrim.addColorStop(1, "rgba(0,0,0,0.85)");
        ctx.fillStyle = scrim;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      } else if (template === "cinema-noir") {
        drawImageCover(ctx, img, 0, 180, CANVAS_W, CANVAS_H - 360, kenScale, panX, 0);
        // Cinema letterbox bars top & bottom
        ctx.fillStyle = "#06070A";
        ctx.fillRect(0, 0, CANVAS_W, 200);
        ctx.fillRect(0, CANVAS_H - 220, CANVAS_W, 220);
        ctx.strokeStyle = "rgba(212, 183, 122, 0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(60, 200);
        ctx.lineTo(CANVAS_W - 60, 200);
        ctx.moveTo(60, CANVAS_H - 220);
        ctx.lineTo(CANVAS_W - 60, CANVAS_H - 220);
        ctx.stroke();
      } else {
        // Luxury Signature Gold framed editorial layout
        ctx.save();
        if ("filter" in ctx) ctx.filter = "blur(32px) brightness(0.42)";
        drawImageCover(ctx, img, 0, 0, CANVAS_W, CANVAS_H, 1.15);
        ctx.restore();

        const bgDim = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        bgDim.addColorStop(0, "rgba(10,12,18,0.68)");
        bgDim.addColorStop(0.5, "rgba(10,12,18,0.28)");
        bgDim.addColorStop(1, "rgba(8,9,14,0.88)");
        ctx.fillStyle = bgDim;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Framed inner card (supports BOTH portrait & landscape DSLR photos seamlessly!)
        const frameX = 64;
        const frameY = 230;
        const frameW = CANVAS_W - 128;
        const frameH = 1320;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = 45;
        drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 42);
        ctx.fillStyle = "#0F1118";
        ctx.fill();
        ctx.clip();
        drawImageCover(ctx, img, frameX, frameY, frameW, frameH, kenScale, panX, 0);
        ctx.restore();

        // Crisp champagne gold border around photo card
        ctx.strokeStyle = "rgba(212, 183, 122, 0.72)";
        ctx.lineWidth = 3.5;
        drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 42);
        ctx.stroke();
      }

      // Top Event Header Pill
      ctx.save();
      ctx.fillStyle = "rgba(10,12,18,0.68)";
      drawRoundedRect(ctx, 84, 78, CANVAS_W - 168, 92, 46);
      ctx.fill();
      ctx.strokeStyle = "rgba(212, 183, 122, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#D4B77A";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "left";
      const headerTitle = (customTitle.trim() || ev?.name || "Live Highlights").slice(0, 34);
      ctx.fillText(`✦  ${headerTitle}`, 128, 134);

      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 24px monospace";
      ctx.fillText(`${idx + 1} / ${slides.length}`, CANVAS_W - 128, 133);
      ctx.restore();

      // Floating Watermark Logo
      if (showWatermark && wmImg) {
        const targetW = 240;
        const targetH = (wmImg.naturalHeight / (wmImg.naturalWidth || 1)) * targetW;
        const wmY = template === "cinema-noir" ? CANVAS_H - 185 : 1625;
        ctx.save();
        ctx.globalAlpha = alpha * 0.92;
        ctx.drawImage(wmImg, CANVAS_W - targetW - 84, wmY, targetW, targetH);
        ctx.restore();
      }

      // Guest Credit & Highlight Badge
      if (showCredits) {
        const badgeY = template === "cinema-noir" ? CANVAS_H - 160 : 1645;
        ctx.save();
        ctx.fillStyle = "rgba(12,14,20,0.75)";
        drawRoundedRect(ctx, 74, badgeY, 640, 128, 30);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 34px sans-serif";
        const gName = (photo.guestName || "Captured Live").slice(0, 26);
        ctx.fillText(gName, 108, badgeY + 54);

        ctx.fillStyle = "#D4B77A";
        ctx.font = "600 24px sans-serif";
        const subText =
          photo.caption?.trim()
            ? photo.caption.trim().slice(0, 38)
            : `AI Score ${photo.highlightScore || photo.qualityScore || 92}%  •  ♥ ${photo.likes || 0} Likes`;
        ctx.fillText(subText, 108, badgeY + 96);
        ctx.restore();
      }

      ctx.restore();
    };

    // Draw current slide
    const nextIdx = slideIdx + 1 < slides.length ? slideIdx + 1 : -1;
    const inTransition = nextIdx !== -1 && slideElapsed > slideMs - transMs;

    if (inTransition) {
      const tp = Math.min(1, (slideElapsed - (slideMs - transMs)) / transMs);
      if (transition === "slide") {
        drawSingleSlide(slideIdx, slideProgress, 1 - tp * 0.3, -tp * CANVAS_W);
        drawSingleSlide(nextIdx, 0, 1, (1 - tp) * CANVAS_W);
      } else if (transition === "zoom") {
        drawSingleSlide(slideIdx, slideProgress + tp * 0.25, 1 - tp);
        drawSingleSlide(nextIdx, 0, tp);
      } else {
        drawSingleSlide(slideIdx, slideProgress, 1 - tp);
        drawSingleSlide(nextIdx, 0, tp);
      }
    } else {
      drawSingleSlide(slideIdx, slideProgress, 1);
    }

    // Top-of-frame Reel Progress Segments (Instagram Story style!)
    const segGap = 10;
    const totalPad = 140;
    const segW = (CANVAS_W - totalPad - (slides.length - 1) * segGap) / slides.length;
    for (let i = 0; i < slides.length; i++) {
      const sx = 70 + i * (segW + segGap);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      drawRoundedRect(ctx, sx, 42, segW, 8, 4);
      ctx.fill();

      const fillRatio = i < slideIdx ? 1 : i === slideIdx ? slideProgress : 0;
      if (fillRatio > 0) {
        ctx.fillStyle = "#D4B77A";
        drawRoundedRect(ctx, sx, 42, Math.max(8, segW * fillRatio), 8, 4);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  // Preload all chosen slides & watermark before preview or export
  const prepareAssets = async (): Promise<{ slides: LoadedSlide[]; wm: HTMLImageElement | null }> => {
    setStatusLabel("Preparing high-resolution photos...");
    const wmPromise = loadCorsImage("/api/reels/image?asset=watermark");
    const loaded = await Promise.all(
      orderedSelectedPhotos.map(async (p) => {
        const img = await loadCorsImage(p.proxyUrl || `/api/reels/image?id=${encodeURIComponent(p.id)}`);
        return img ? { photo: p, img } : null;
      })
    );
    const slides = loaded.filter((x): x is LoadedSlide => x !== null);
    const wm = await wmPromise;
    loadedSlidesRef.current = slides;
    wmImageRef.current = wm;
    return { slides, wm };
  };

  const handleStartPreview = async () => {
    if (orderedSelectedPhotos.length === 0) return;
    stopPlaybackAndAudio();
    setProgress(0);

    const { slides, wm } = await prepareAssets();
    if (slides.length === 0) {
      setStatusLabel("Could not load images for reel.");
      return;
    }

    const durMs = introMs + slides.length * slideMs + outroMs;
    await startAudioEngine(true, false, durMs / 1000);

    setIsPlaying(true);
    setStatusLabel(`Previewing ${slides.length}-moment Reel (${Math.round(durMs / 1000)}s)`);

    const startTime = performance.now();
    let lastPct = -1;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        renderFrame(ctx, slides, wm, activeEvent, elapsed);
      }
      const pct = Math.min(100, Math.round((elapsed / durMs) * 100));
      if (pct !== lastPct) {
        lastPct = pct;
        setProgress(pct);
      }

      if (elapsed < durMs) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        stopPlaybackAndAudio();
        setProgress(100);
        setStatusLabel("Preview complete! Click Export & Download to save video.");
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  const handleExportVideo = async () => {
    if (orderedSelectedPhotos.length === 0) return;
    stopPlaybackAndAudio();
    setProgress(0);
    if (exportedVideoUrl) {
      URL.revokeObjectURL(exportedVideoUrl);
      setExportedVideoUrl(null);
      setExportedBlob(null);
    }

    const { slides, wm } = await prepareAssets();
    if (slides.length === 0) {
      setStatusLabel("No readable images available for video export.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === "undefined") {
      setStatusLabel("Video recording requires a modern browser (Chrome, Edge, Safari, Android Chrome).");
      return;
    }

    // Paint initial frame immediately before captureStream starts
    const initCtx = canvas.getContext("2d");
    if (initCtx) {
      renderFrame(initCtx, slides, wm, activeEvent, 0);
    }

    const durMs = introMs + slides.length * slideMs + outroMs;
    const audioStream = await startAudioEngine(false, true, durMs / 1000);
    const videoStream = canvas.captureStream(30);

    const combinedStream = new MediaStream();
    videoStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
    if (audioStream) {
      audioStream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
    }

    let recorderInfo: { recorder: MediaRecorder; mimeType: string; ext: "mp4" | "webm" };
    try {
      recorderInfo = createSafeMediaRecorder(combinedStream);
    } catch (err) {
      console.error("MediaRecorder init error:", err);
      stopPlaybackAndAudio();
      setStatusLabel("Could not initialize video encoder on this browser.");
      return;
    }

    const { recorder, mimeType, ext } = recorderInfo;
    mediaRecorderRef.current = recorder;

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = () => {
      stopPlaybackAndAudio();
      setStatusLabel("Recording interrupted. Try Silent or Balanced speed.");
    };

    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType || `video/${ext}` });
      if (finalBlob.size === 0) {
        stopPlaybackAndAudio();
        setStatusLabel("Export produced empty stream. Please try Preview first.");
        return;
      }
      const url = URL.createObjectURL(finalBlob);
      setExportedBlob(finalBlob);
      setExportedVideoUrl(url);
      setExportedExt(ext);
      stopPlaybackAndAudio();
      setProgress(100);
      setStatusLabel(`✓ 9:16 HD Video Ready (${(finalBlob.size / (1024 * 1024)).toFixed(1)} MB .${ext.toUpperCase()})`);
    };

    setIsExporting(true);
    setStatusLabel(`Rendering 1080×1920 Vertical Video (${Math.round(durMs / 1000)}s)...`);
    recorder.start(250);

    const startTime = performance.now();
    let lastPct = -1;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        renderFrame(ctx, slides, wm, activeEvent, elapsed);
      }
      const pct = Math.min(99, Math.round((elapsed / durMs) * 100));
      if (pct !== lastPct) {
        lastPct = pct;
        setProgress(pct);
      }

      if (elapsed < durMs) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  const handleTogglePhoto = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMovePhoto = (index: number, dir: -1 | 1) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const handleCustomAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    customAudioFileRef.current = await file.arrayBuffer();
    setCustomAudioName(file.name);
    setAudioMode("custom");
  };

  const handleNativeShare = async () => {
    if (!exportedBlob || !navigator.share) return;
    try {
      const slug = (activeEvent?.name || "signature-reel").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const file = new File([exportedBlob], `${slug}-story-reel.${exportedExt}`, {
        type: exportedBlob.type || `video/${exportedExt}`,
      });
      await navigator.share({
        title: `${activeEvent?.name || "Live Highlights"} — 9:16 Story Reel`,
        text: "Watch our live event highlights reel from Signature by Marvan ✨",
        files: [file],
      });
    } catch (_) {}
  };

  const fileSlug = (activeEvent?.name || "highlights").toLowerCase().replace(/[^a-z0-9]+/g, "_");

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Clapperboard className="w-7 h-7 text-accent" />
            9:16 Instagram Story &amp; Reels Studio
          </h2>
          <p className="text-white/60 text-sm mt-1">
            Auto-curates the sharpest, most-loved moments into a vertical 1080×1920 branded video ready for Instagram Stories, Reels &amp; WhatsApp Status.
          </p>
        </div>

        {mode === "studio" && events.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                loadReelData(e.target.value, sortMode);
              }}
              className="bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.code})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadReelData(selectedEventId, sortMode)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-accent transition-all"
              title="Refresh Photos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-accent" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-accent">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="text-xs uppercase tracking-widest text-white/50">Loading Event Highlights...</p>
        </div>
      ) : allPhotos.length === 0 ? (
        <GlassCard className="p-12 text-center space-y-4">
          <Film className="w-14 h-14 text-accent/50 mx-auto" />
          <h3 className="text-xl font-bold text-white">No Approved Photos Yet</h3>
          <p className="text-sm text-white/60 max-w-md mx-auto">
            Upload event photos first via Live Tether or Host Upload, then generate your branded 9:16 video reel in one click.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 9:16 Smartphone Stage Preview + Export Output */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-5">
            {/* Luxury Phone Mockup Frame */}
            <div className="relative w-full max-w-[330px] aspect-[9/16] rounded-[2.6rem] p-2.5 bg-gradient-to-b from-zinc-700 via-zinc-900 to-black border border-accent/40 shadow-[0_25px_70px_-15px_rgba(212,183,122,0.3)]">
              <div className="w-24 h-5 bg-black rounded-b-2xl mx-auto absolute top-2.5 left-1/2 -translate-x-1/2 z-20 border-x border-b border-white/10" />
              <div className="relative w-full h-full rounded-[2.1rem] overflow-hidden bg-black">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="w-full h-full object-contain"
                />
                {(isPlaying || isExporting) && (
                  <div className="absolute bottom-3 left-3 right-3 z-20 bg-black/75 backdrop-blur px-3 py-2 rounded-xl border border-white/10">
                    <div className="flex justify-between items-center text-[10px] text-white/80 font-mono mb-1">
                      <span>{isExporting ? "EXPORTING 1080×1920" : "PREVIEW PLAYING"}</span>
                      <span className="text-accent font-bold">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D4B77A] to-amber-300 transition-all duration-150"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Playback & Export Buttons */}
            <div className="w-full max-w-[330px] space-y-3">
              <div className="text-center text-xs text-white/60 min-h-[20px]">{statusLabel}</div>

              <div className="grid grid-cols-2 gap-3">
                {isPlaying || isExporting ? (
                  <GlassButton
                    type="button"
                    variant="secondary"
                    onClick={stopPlaybackAndAudio}
                    className="col-span-2 flex items-center justify-center gap-2 py-3 text-sm border-red-500/40 text-red-400"
                  >
                    <Square className="w-4 h-4 fill-red-400" />
                    Stop {isExporting ? "Export" : "Preview"}
                  </GlassButton>
                ) : (
                  <>
                    <GlassButton
                      type="button"
                      variant="secondary"
                      onClick={handleStartPreview}
                      disabled={orderedSelectedPhotos.length === 0}
                      className="flex items-center justify-center gap-2 py-3 text-xs font-bold"
                    >
                      <Play className="w-4 h-4 text-accent fill-accent" />
                      Preview Reel
                    </GlassButton>
                    <GlassButton
                      type="button"
                      variant="primary"
                      onClick={handleExportVideo}
                      disabled={orderedSelectedPhotos.length === 0}
                      className="flex items-center justify-center gap-2 py-3 text-xs font-bold shadow-lg shadow-accent/20"
                    >
                      <Clapperboard className="w-4 h-4" />
                      Export HD Video
                    </GlassButton>
                  </>
                )}
              </div>
            </div>

            {/* Rendered Video Card */}
            {exportedVideoUrl && (
              <GlassCard className="w-full max-w-[330px] p-4 space-y-3 border-emerald-500/30 bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Exported Vertical Reel
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/50 text-white/70">
                    .{exportedExt}
                  </span>
                </div>

                <video
                  src={exportedVideoUrl}
                  controls
                  playsInline
                  loop
                  className="w-full rounded-xl border border-white/10 bg-black aspect-[9/16] max-h-[280px]"
                />

                <div className="flex gap-2">
                  <a
                    href={exportedVideoUrl}
                    download={`${fileSlug}_9x16_reel.${exportedExt}`}
                    className="flex-1"
                  >
                    <GlassButton variant="primary" className="w-full py-2.5 text-xs flex items-center justify-center gap-1.5">
                      <Download className="w-4 h-4" /> Download .{exportedExt.toUpperCase()}
                    </GlassButton>
                  </a>
                  {canShare && (
                    <GlassButton
                      type="button"
                      variant="secondary"
                      onClick={handleNativeShare}
                      className="px-3 py-2.5 text-xs flex items-center gap-1.5"
                      title="Share directly to Instagram / WhatsApp"
                    >
                      <Share2 className="w-4 h-4 text-accent" />
                    </GlassButton>
                  )}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Right Column: Studio Style, Soundtrack & Curated Clips */}
          <div className="lg:col-span-7 space-y-6">
            {/* Template & Motion Settings */}
            <GlassCard className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-accent" /> Luxury Reel Template &amp; Motion
                </h3>
                <span className="text-xs font-mono text-accent">
                  {orderedSelectedPhotos.length} Clips · ~{Math.round(totalDurationMs / 1000)}s Total
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "signature-gold", name: "Signature Gold", desc: "Blurred aura + gold border" },
                  { id: "editorial-minimal", name: "Editorial Full-Bleed", desc: "Edge-to-edge 9:16 portrait" },
                  { id: "cinema-noir", name: "Cinema Letterbox", desc: "Obsidian film frame bars" },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplate(tpl.id as ReelTemplate)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      template === tpl.id
                        ? "bg-accent/15 border-accent text-white shadow-md shadow-accent/10"
                        : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    <div className="text-xs font-bold">{tpl.name}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{tpl.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Custom Reel Headline (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder={activeEvent?.name || "Signature Wedding Moments"}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Slide Speed
                    </label>
                    <select
                      value={slideSeconds}
                      onChange={(e) => setSlideSeconds(parseFloat(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value={1.5}>Fast (1.5s)</option>
                      <option value={2.2}>Balanced (2.2s)</option>
                      <option value={3.0}>Cinematic (3.0s)</option>
                      <option value={4.0}>Slow Dreamy (4.0s)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Transition
                    </label>
                    <select
                      value={transition}
                      onChange={(e) => setTransition(e.target.value as TransitionType)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                    >
                      <option value="crossfade">Crossfade</option>
                      <option value="slide">Story Slide</option>
                      <option value="zoom">Zoom Dissolve</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Branding Toggles */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "Intro Title Card", val: showIntro, set: setShowIntro },
                  { label: "Studio Outro Card", val: showOutro, set: setShowOutro },
                  { label: "Studio Watermark", val: showWatermark, set: setShowWatermark },
                  { label: "Guest Credits", val: showCredits, set: setShowCredits },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => opt.set(!opt.val)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      opt.val
                        ? "bg-accent/15 border-accent/40 text-accent"
                        : "bg-white/[0.02] border-white/10 text-white/45"
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${opt.val ? "opacity-100" : "opacity-25"}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Soundtrack Mixer Card */}
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-accent" /> Built-In Soundtrack Mixer
                </h3>
                <button
                  type="button"
                  onClick={() => setMutePreview(!mutePreview)}
                  className="text-xs text-white/60 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10"
                >
                  {mutePreview ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-accent" />}
                  {mutePreview ? "Preview Muted" : "Audio On"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAudioMode("synth-pad")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    audioMode === "synth-pad"
                      ? "bg-accent/15 border-accent text-white"
                      : "bg-white/[0.02] border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">Golden Hour Pad</div>
                  <div className="text-[11px] text-white/50">Built-in ambient piano synth</div>
                </button>

                <label
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    audioMode === "custom"
                      ? "bg-accent/15 border-accent text-white"
                      : "bg-white/[0.02] border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-accent" /> Custom Audio
                  </div>
                  <div className="text-[11px] text-white/50 truncate">
                    {customAudioName || "Upload MP3 / WAV / M4A"}
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleCustomAudioUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setAudioMode("silent")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    audioMode === "silent"
                      ? "bg-accent/15 border-accent text-white"
                      : "bg-white/[0.02] border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  <div className="text-xs font-bold">Silent (Add on IG)</div>
                  <div className="text-[11px] text-white/50">Add trending IG audio in-app</div>
                </button>
              </div>
            </GlassCard>

            {/* AI Curated Moments Picker & Order */}
            <GlassCard className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-accent" /> Curated Moments ({selectedIds.length} Selected)
                  </h3>
                  <p className="text-xs text-white/50">
                    Ranked automatically by AI Sharpness + Guest Likes. Toggle or reorder clips below.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(allPhotos.slice(0, Math.min(6, allPhotos.length)).map((p) => p.id))}
                    className="px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-semibold"
                  >
                    Top 6 AI
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(allPhotos.slice(0, Math.min(10, allPhotos.length)).map((p) => p.id))}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-xs font-semibold"
                  >
                    Top 10
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = sortMode === "highlights" ? "newest" : "highlights";
                      setSortMode(next);
                      loadReelData(selectedEventId, next);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs"
                  >
                    Sort: {sortMode === "highlights" ? "AI + Likes" : "Newest"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {allPhotos.map((photo) => {
                  const selIdx = selectedIds.indexOf(photo.id);
                  const isSelected = selIdx >= 0;
                  return (
                    <div
                      key={photo.id}
                      onClick={() => handleTogglePhoto(photo.id)}
                      className={`group relative aspect-[3/4] rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-accent shadow-lg shadow-accent/15"
                          : "border-white/10 opacity-60 hover:opacity-95"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40" />

                      {/* Selection Badge */}
                      <div
                        className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                          isSelected
                            ? "bg-accent text-black border-accent"
                            : "bg-black/60 text-white/70 border-white/30"
                        }`}
                      >
                        {isSelected ? selIdx + 1 : "+"}
                      </div>

                      {/* Score */}
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-accent border border-white/10">
                        ★ {photo.highlightScore || photo.qualityScore || 88}%
                      </div>

                      {/* Reorder buttons when selected */}
                      {isSelected && (
                        <div
                          className="absolute bottom-2 right-2 flex gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleMovePhoto(selIdx, -1)}
                            className="p-1 rounded bg-black/80 hover:bg-accent hover:text-black text-white border border-white/15"
                            title="Move Earlier"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePhoto(selIdx, 1)}
                            className="p-1 rounded bg-black/80 hover:bg-accent hover:text-black text-white border border-white/15"
                            title="Move Later"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="absolute bottom-2 left-2 right-14 truncate">
                        <p className="text-[10px] font-bold text-white truncate">{photo.guestName || "Photo"}</p>
                        <p className="text-[10px] text-white/60 flex items-center gap-1">
                          <Heart className="w-2.5 h-2.5 fill-red-400 text-red-400" /> {photo.likes || 0}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
