import path from "path";
import fs from "fs";

export function isVercelEnv(): boolean {
  return Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);
}

export function getDataFilePath(filename: string): string {
  const isVercel = isVercelEnv();
  const baseDir = isVercel ? "/tmp" : process.cwd();
  const targetDir = path.join(baseDir, "data");
  
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  } catch (_) {}

  const targetPath = path.join(targetDir, filename);

  // If on Vercel and file doesn't exist in /tmp yet, seed from original project data
  if (isVercel && !fs.existsSync(targetPath)) {
    try {
      const seedPath = path.join(process.cwd(), "data", filename);
      if (fs.existsSync(seedPath)) {
        fs.copyFileSync(seedPath, targetPath);
      }
    } catch (_) {}
  }

  return targetPath;
}

export function getUploadsDir(): string {
  const isVercel = isVercelEnv();
  const dir = isVercel
    ? path.join("/tmp", "uploads")
    : path.join(process.cwd(), "public", "uploads");

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (_) {}

  return dir;
}

export { getPublicBaseUrl } from "./publicUrl";
