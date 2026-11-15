import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { loadPhotosAsync } from "@/lib/storage";
import { getWatermarkConfigAsync } from "@/lib/watermark";
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

      const safeName = path.basename(target.split("?")[0]);
      const publicPath = path.join(process.cwd(), "public", safeName);
      if (fs.existsSync(/*turbopackIgnore: true*/ publicPath)) {
        return respondWithImage(fs.readFileSync(/*turbopackIgnore: true*/ publicPath), inferContentType(safeName, "image/png"));
      }

      const tmpUpload = path.join(getUploadsDir(), safeName);
      if (fs.existsSync(/*turbopackIgnore: true*/ tmpUpload)) {
        return respondWithImage(fs.readFileSync(/*turbopackIgnore: true*/ tmpUpload), inferContentType(safeName, "image/png"));
      }

      const cloudLogo = await fetchFromCloudStorage(safeName);
      if (cloudLogo) {
        return respondWithImage(cloudLogo.buffer, cloudLogo.contentType);
      }

      const fallbackLogo = path.join(process.cwd(), "public", "signature-marvan-logo.png");
      if (fs.existsSync(fallbackLogo)) {
        return respondWithImage(fs.readFileSync(fallbackLogo), "image/png");
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
    const sendPhotoBuffer = async (rawBuf: Buffer, ct: string) => {
      const opt = await optimizeForReel(rawBuf, targetWidth);
      return respondWithImage(opt.buf, opt.mime || ct);
    };

    // Try remote URL first if HTTP/HTTPS
    if (chosenUrl.startsWith("http://") || chosenUrl.startsWith("https://")) {
      const resp = await fetch(chosenUrl, { cache: "no-store" });
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        return await sendPhotoBuffer(buf, resp.headers.get("content-type") || photo.mimeType || "image/jpeg");
      }
    }

    // Local / Public / Cloud proxy fallback
    if (chosenUrl.startsWith("/")) {
      const publicRoot = path.resolve(process.cwd(), "public");
      const relPath = path.resolve(publicRoot, "." + chosenUrl.split("?")[0]);
      if (relPath.startsWith(publicRoot) && fs.existsSync(/*turbopackIgnore: true*/ relPath) && fs.statSync(relPath).isFile()) {
        return await sendPhotoBuffer(fs.readFileSync(/*turbopackIgnore: true*/ relPath), inferContentType(relPath, photo.mimeType || "image/jpeg"));
      }
    }

    const safeName = path.basename(chosenUrl.split("?")[0]);
    const tmpPath = path.join(getUploadsDir(), safeName);
    if (fs.existsSync(/*turbopackIgnore: true*/ tmpPath)) {
      return await sendPhotoBuffer(fs.readFileSync(/*turbopackIgnore: true*/ tmpPath), inferContentType(safeName, photo.mimeType || "image/jpeg"));
    }

    const publicUploadsPath = path.join(process.cwd(), "public", "uploads", safeName);
    if (fs.existsSync(/*turbopackIgnore: true*/ publicUploadsPath)) {
      return await sendPhotoBuffer(fs.readFileSync(/*turbopackIgnore: true*/ publicUploadsPath), inferContentType(safeName, photo.mimeType || "image/jpeg"));
    }

    const cloudFile = await fetchFromCloudStorage(safeName);
    if (cloudFile) {
      return await sendPhotoBuffer(cloudFile.buffer, cloudFile.contentType);
    }

    // If thumbnail was requested but missing, retry original full-resolution URL
    if (useThumb && photo.url && photo.url !== chosenUrl) {
      if (photo.url.startsWith("http")) {
        const resp = await fetch(photo.url, { cache: "no-store" });
        if (resp.ok) {
          return await sendPhotoBuffer(Buffer.from(await resp.arrayBuffer()), resp.headers.get("content-type") || "image/jpeg");
        }
      }
      const origName = path.basename(photo.url.split("?")[0]);
      const cloudOrig = await fetchFromCloudStorage(origName);
      if (cloudOrig) {
        return await sendPhotoBuffer(cloudOrig.buffer, cloudOrig.contentType);
      }
    }

    return NextResponse.json({ error: "Photo binary not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Proxy failure" }, { status: 500 });
  }
}

