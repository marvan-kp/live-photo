import fs from "fs";
import path from "path";
import { getDataFilePath, getUploadsDir } from "./paths";

async function getSharp(): Promise<any> {
  try {
    const mod = await (Function('return import("sharp")')() as Promise<any>);
    return mod.default || mod;
  } catch (err) {
    console.warn("Sharp image processing is unavailable in this environment:", err);
    return null;
  }
}

export interface WatermarkConfig {
  enabled: boolean;
  logoPath: string;
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  scale: number; // 0.10 to 0.40 (e.g. 0.22 = 22% of photo width)
  opacity: number; // 0.1 to 1.0 (e.g. 0.85)
  margin: number; // margin in pixels
}

const CONFIG_FILE = getDataFilePath("watermark_config.json");

const DEFAULT_CONFIG: WatermarkConfig = {
  enabled: true,
  logoPath: "/signature-marvan-logo.png",
  position: "bottom-right",
  scale: 0.22,
  opacity: 0.88,
  margin: 28,
};

export function getWatermarkConfig(): WatermarkConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn("Could not read watermark_config.json, using default:", e);
  }
  return { ...DEFAULT_CONFIG };
}

export function saveWatermarkConfig(config: Partial<WatermarkConfig>): WatermarkConfig {
  const current = getWatermarkConfig();
  const updated: WatermarkConfig = { ...current, ...config };
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save watermark config:", e);
  }
  return updated;
}

function resolveLogoBuffer(logoPath: string): Buffer | null {
  try {
    // 1. Direct local file path
    if (fs.existsSync(logoPath)) {
      return fs.readFileSync(logoPath);
    }

    // 2. Public directory (e.g. "/signature-marvan-logo.png")
    const cleanPublicName = logoPath.replace(/^\//, "");
    const publicPath = path.join(process.cwd(), "public", cleanPublicName);
    if (fs.existsSync(publicPath)) {
      return fs.readFileSync(publicPath);
    }

    // 3. Dynamic uploads directory
    const uploadsPath = path.join(getUploadsDir(), cleanPublicName);
    if (fs.existsSync(uploadsPath)) {
      return fs.readFileSync(uploadsPath);
    }

    // 4. Default fallback logo
    const defaultLogo = path.join(process.cwd(), "public", "signature-marvan-logo.png");
    if (fs.existsSync(defaultLogo)) {
      return fs.readFileSync(defaultLogo);
    }
  } catch (err) {
    console.warn("Error resolving logo buffer:", err);
  }
  return null;
}

export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const config = getWatermarkConfig();
  if (!config.enabled) {
    return imageBuffer;
  }

  try {
    const sharp = await getSharp();
    if (!sharp) {
      return imageBuffer;
    }

    const baseImage = sharp(imageBuffer);
    const metadata = await baseImage.metadata();
    if (!metadata.width || !metadata.height) {
      return imageBuffer;
    }

    const logoBuffer = resolveLogoBuffer(config.logoPath);
    if (!logoBuffer) {
      return imageBuffer;
    }

    // Target width for the logo relative to base image width
    const targetWidth = Math.max(80, Math.min(metadata.width, Math.round(metadata.width * (config.scale || 0.22))));

    // Resize logo and enforce RGBA transparency
    let preparedLogo = sharp(logoBuffer)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .ensureAlpha();

    // Apply opacity if less than 1.0
    if (config.opacity && config.opacity < 0.99) {
      // Linear modulation for alpha channel
      preparedLogo = preparedLogo.composite([
        {
          input: Buffer.from([255, 255, 255, Math.round(config.opacity * 255)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: "dest-in",
        },
      ]);
    }

    const logoFinalBuffer = await preparedLogo.toBuffer();
    const logoMeta = await sharp(logoFinalBuffer).metadata();
    const logoW = logoMeta.width || targetWidth;
    const logoH = logoMeta.height || Math.round(targetWidth * 0.4);

    const margin = Math.round(Math.min(metadata.width, metadata.height) * 0.025) || config.margin || 24;

    let left = metadata.width - logoW - margin;
    let top = metadata.height - logoH - margin;

    if (config.position === "bottom-left") {
      left = margin;
      top = metadata.height - logoH - margin;
    } else if (config.position === "top-right") {
      left = metadata.width - logoW - margin;
      top = margin;
    } else if (config.position === "top-left") {
      left = margin;
      top = margin;
    }

    // Clamp coordinates within image bounds
    left = Math.max(0, Math.min(left, metadata.width - logoW));
    top = Math.max(0, Math.min(top, metadata.height - logoH));

    return await baseImage
      .composite([
        {
          input: logoFinalBuffer,
          top,
          left,
          blend: "over",
        },
      ])
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (err) {
    console.warn("Watermark compositing error, falling back to original image:", err);
    return imageBuffer;
  }
}
