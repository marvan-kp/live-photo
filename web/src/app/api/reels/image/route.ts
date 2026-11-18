import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { loadPhotosAsync } from "@/lib/storage";
import { getWatermarkConfigAsync, applyWatermark } from "@/lib/watermark";
import { fetchFromCloudStorage } from "@/lib/cloudStorage";
import { getUploadsDir } from "@/lib/paths";

function inferContentType(nameOrUrl: string, fallback = "image/jpeg"): string {
  const clean = nameOrUrl.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  return fallback;
}

async function optimizeForReel(buffer: Buffer, targetWidth?: number): Promise<{ buf: Buffer; mime?: string }> {
  if (!targetWidth || buffer.length < 350_000) {
    return { buf: buffer };
  }
  try {
    let sharp: any = null;
    try {
      const mod = await import("module");
      const reqFn = mod.createRequire(path.join(process.cwd(), "package.json"));
      const loaded = reqFn("sharp");
      sharp = loaded?.default || loaded;
    } catch (_) {
      const mod = await (Function('return import("sharp")')() as Promise<any>);
      sharp = mod?.default || mod;
    }
    if (!sharp) return { buf: buffer };

    const w = Math.min(1800, Math.max(480, targetWidth));
    const out = await sharp(buffer)
      .rotate()
      .resize(w, 2200, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return { buf: out, mime: "image/jpeg" };
  } catch (_) {
    return { buf: buffer };
  }
}

function respondWithImage(buffer: Buffer, contentType: string) {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// Cache for watermarked images to avoid re-processing
const watermarkCache = new Map<string, Promise<Buffer | null>>();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const asset = searchParams.get("asset");
    const photoId = searchParams.get("id");
    const useThumb = searchParams.get("thumb") === "1";
    const wParam = parseInt(searchParams.get("w") || "0", 10);
    const targetWidth = !isNaN(wParam) && wParam > 0 ? wParam : undefined;

    // 1. Studio Watermark Logo Asset
    if (asset === "watermark" || asset === "logo") {
      const wm = await getWatermarkConfigAsync();
      const target = asset === "logo" ? "/logo.png" : wm.logoPath || "/signature-marvan-logo.png";

      if (target.startsWith("http://") || target.startsWith("https://")) {
        try {
          const resp = await fetch(target, { cache: "no-store" });
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            return respondWithImage(buf, resp.headers.get("content-type") || "image/png");
          }
        } catch (_) {}
      }

      // Optimized: Check all paths once with combined logic
      const safeName = path.basename(target.split("?")[0]);
      const pathsToCheck = [
        path.join(process.cwd(), "public", safeName),
        path.join(getUploadsDir(), safeName),
        path.join(process.cwd(), "public", "signature-marvan-logo.png")
      ];

      for (const testPath of pathsToCheck) {
        try {
          if (fs.existsSync(/*turbopackIgnore: true*/ testPath)) {
            return respondWithImage(fs.readFileSync(/*turbopackIgnore: true*/ testPath), inferContentType(testPath, "image/png"));
          }
        } catch (_) {}
      }

      const cloudLogo = await fetchFromCloudStorage(safeName);
      if (cloudLogo) {
        return respondWithImage(cloudLogo.buffer, cloudLogo.contentType);
      }

      return NextResponse.json({ error: "Watermark asset not found" }, { status: 404 });
    }

    // 2. Photo Asset Lookup (Strictly bound to known photo records to avoid arbitrary URL proxying)
    if (!photoId) {
      return NextResponse.json({ error: "Missing photo id" }, { status: 400 });
    }

    const photosMap = await loadPhotosAsync();
    const photo = photosMap.get(photoId);
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const chosenUrl = useThumb && photo.thumbnailUrl ? photo.thumbnailUrl : photo.url;

    // Helper to apply EXIF rotation / 1400px optimization cleanly before responding
    const sendPhotoBuffer = async (rawBuf: Buffer, ct: string, applyWm: boolean = false) => {
      let bufferToProcess = rawBuf;
      if (applyWm) {
        // Cache watermarked images to avoid re-processing
        const cacheKey = `${photoId}:${Buffer.from(rawBuf).toString('base64')}`;
        if (!watermarkCache.has(cacheKey)) {
          watermarkCache.set(cacheKey, applyWatermark(rawBuf));
        }
        bufferToProcess = await watermarkCache.get(cacheKey) || rawBuf;
      }
      const opt = await optimizeForReel(bufferToProcess, targetWidth);
      return respondWithImage(opt.buf, opt.mime || ct);
    };

    // Try remote URL first if HTTP/HTTPS
    if (chosenUrl.startsWith("http://") || chosenUrl.startsWith("https://")) {
      const resp = await fetch(chosenUrl, { cache: "no-store" });
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        const shouldWatermark = !!(photo as any).reelWatermarked;
        return await sendPhotoBuffer(buf, resp.headers.get("content-type") || photo.mimeType || "image/jpeg", shouldWatermark);
      }
    }

    // Local / Public / Cloud proxy fallback - optimized to avoid redundant checks
    if (chosenUrl.startsWith("/")) {
      const publicRoot = path.resolve(process.cwd(), "public");
      const relPath = path.resolve(publicRoot, "." + chosenUrl.split("?")[0]);
      // Combine path checks to avoid multiple fs.existsSync calls
      if (relPath.startsWith(publicRoot) && fs.statSync(relPath).isFile()) {
        const shouldWatermark = !!(photo as any).reelWatermarked;
        return await sendPhotoBuffer(fs.readFileSync(relPath), inferContentType(relPath, photo.mimeType || "image/jpeg"), shouldWatermark);
      }
    }

    // Single path resolution for both temporary and public uploads directories
    const safeName = path.basename(chosenUrl.split("?")[0]);
    const possiblePaths = [
      path.join(getUploadsDir(), safeName),
      path.join(process.cwd(), "public", "uploads", safeName)
    ];

    for (const testPath of possiblePaths) {
      try {
        if (fs.existsSync(/*turbopackIgnore: true*/ testPath) && fs.statSync(/*turbopackIgnore: true*/ testPath).isFile()) {
          const shouldWatermark = !!(photo as any).reelWatermarked;
          return await sendPhotoBuffer(fs.readFileSync(/*turbopackIgnore: true*/ testPath), inferContentType(testPath, photo.mimeType || "image/jpeg"), shouldWatermark);
        }
      } catch (_) {}
    }

    const cloudFile = await fetchFromCloudStorage(safeName);
    if (cloudFile) {
      const shouldWatermark = !!(photo as any).reelWatermarked;
      return await sendPhotoBuffer(cloudFile.buffer, cloudFile.contentType, shouldWatermark);
    }

    // If thumbnail was requested but missing, retry original full-resolution URL
    if (useThumb && photo.url && photo.url !== chosenUrl) {
      if (photo.url.startsWith("http")) {
        const resp = await fetch(photo.url, { cache: "no-store" });
        if (resp.ok) {
          const shouldWatermark = !!(photo as any).reelWatermarked;
          return await sendPhotoBuffer(Buffer.from(await resp.arrayBuffer()), resp.headers.get("content-type") || "image/jpeg", shouldWatermark);
        }
      }
      const origName = path.basename(photo.url.split("?")[0]);
      const cloudOrig = await fetchFromCloudStorage(origName);
      if (cloudOrig) {
        const shouldWatermark = !!(photo as any).reelWatermarked;
        return await sendPhotoBuffer(cloudOrig.buffer, cloudOrig.contentType, shouldWatermark);
      }
    }

    return NextResponse.json({ error: "Photo binary not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Proxy failure" }, { status: 500 });
  }
}

