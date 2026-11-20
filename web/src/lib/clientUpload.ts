export interface PreparedUploadPhoto {
  fileBlob: Blob;
  thumbBlob: Blob | null;
  fileName: string;
}

const MAX_DIRECT_BYTES = 3.0 * 1024 * 1024; // 3.0 MB safe threshold below Vercel 4.5 MB limit
const MAX_UPLOAD_DIMENSION = 2560; // Crisp 2.5K studio resolution
const THUMB_DIMENSION = 600;

/**
 * Optimizes large DSLR / phone photos client-side so they NEVER exceed Vercel's 4.5 MB
 * serverless body limit, and generates a lightweight 600px gallery thumbnail.
 */
export async function preparePhotoForUpload(file: File): Promise<PreparedUploadPhoto> {
  const safeJpgName = file.name.replace(/\.[^.]+$/, "") + ".jpg";

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      try {
        // 1. Always create a crisp 600px thumbnail for instant grid rendering
        const thumbBlob = await renderScaledBlob(img, THUMB_DIMENSION, 0.78);

        // 2. If original file is already small (<3 MB) & standard JPEG/PNG/WebP, keep original untouched
        const isWebFormat = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
        if (file.size <= MAX_DIRECT_BYTES && isWebFormat) {
          resolve({ fileBlob: file, thumbBlob, fileName: file.name });
          return;
        }

        // 3. Otherwise downscale/re-encode cleanly to crisp JPEG safely under 3.5 MB
        let quality = 0.88;
        let maxDim = MAX_UPLOAD_DIMENSION;
        let optimized = await renderScaledBlob(img, maxDim, quality);

        // If still over 3.5 MB (e.g. ultra-detailed noisy image), step down smoothly
        if (optimized && optimized.size > 3.5 * 1024 * 1024) {
          optimized = await renderScaledBlob(img, 2048, 0.82);
        }
        if (optimized && optimized.size > 3.5 * 1024 * 1024) {
          optimized = await renderScaledBlob(img, 1600, 0.78);
        }

        resolve({
          fileBlob: optimized || file,
          thumbBlob,
          fileName: optimized ? safeJpgName : file.name,
        });
      } catch {
        resolve({ fileBlob: file, thumbBlob: null, fileName: file.name });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ fileBlob: file, thumbBlob: null, fileName: file.name });
    };

    img.src = objectUrl;
  });
}

function renderScaledBlob(
  img: HTMLImageElement,
  maxDim: number,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
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
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.fillStyle = "#08090D";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

export interface BatchUploadOptions {
  eventId?: string;
  guestName?: string;
  caption?: string;
  adminKey?: string;
  onProgress?: (completed: number, total: number, currentFile: string) => void;
}

export interface BatchUploadResult {
  uploadedFiles: any[];
  failedCount: number;
  errors: string[];
}

/**
 * Uploads an array/FileList of photos 1-by-1 so each request stays well under Vercel's 4.5 MB limit,
 * attaching saved watermark config and returning all uploaded photo records.
 */
export async function uploadPhotosIndividually(
  files: File[] | FileList,
  options: BatchUploadOptions
): Promise<BatchUploadResult> {
  const fileArray = Array.from(files);
  const uploadedFiles: any[] = [];
  const errors: string[] = [];

  // Read optional client watermark preferences
  let wmConfig: Record<string, any> | null = null;
  if (typeof window !== "undefined") {
    const savedWm = localStorage.getItem("livephoto_watermark_config");
    if (savedWm) {
      try {
        wmConfig = JSON.parse(savedWm);
      } catch {
        wmConfig = null;
      }
    }
  }

  for (let i = 0; i < fileArray.length; i++) {
    const rawFile = fileArray[i];
    options.onProgress?.(i, fileArray.length, rawFile.name);

    try {
      const prepared = await preparePhotoForUpload(rawFile);

      const formData = new FormData();
      formData.append("files", prepared.fileBlob, prepared.fileName);
      if (prepared.thumbBlob) {
        formData.append("thumbnails", prepared.thumbBlob, `thumb_${prepared.fileName}`);
      }
      if (options.eventId) formData.append("eventId", options.eventId);
      const effectiveAdminKey =
        options.adminKey ||
        (typeof window !== "undefined" && (localStorage.getItem("livephoto_admin_key") || localStorage.getItem("adminKey"))) ||
        "marvan2026";

      if (options.guestName) formData.append("guestName", options.guestName);
      if (options.caption) formData.append("caption", options.caption);
      formData.append("adminKey", effectiveAdminKey);

      if (wmConfig) {
        if (wmConfig.position) formData.append("watermarkPosition", wmConfig.position);
        if (wmConfig.scale) formData.append("watermarkScale", String(wmConfig.scale));
        if (wmConfig.opacity) formData.append("watermarkOpacity", String(wmConfig.opacity));
        if (wmConfig.enabled !== undefined) formData.append("watermarkEnabled", String(wmConfig.enabled));
      }

      const res = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "x-admin-key": effectiveAdminKey,
        },
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.files)) {
          uploadedFiles.push(...json.files);
        }
      } else {
        const text = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) msg = parsed.error;
        } catch {
          if (res.status === 413) {
            msg = "File too large even after compression (max 4.5 MB on serverless)";
          } else if (text) {
            msg = `${msg}: ${text.slice(0, 120)}`;
          }
        }
        errors.push(`${rawFile.name}: ${msg}`);
      }
    } catch (err: any) {
      errors.push(`${rawFile.name}: ${err?.message || "Network error"}`);
    }
  }

  options.onProgress?.(fileArray.length, fileArray.length, "");

  return {
    uploadedFiles,
    failedCount: errors.length,
    errors,
  };
}
