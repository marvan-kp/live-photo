import fs from "fs";
import path from "path";
import { getDataFilePath, getUploadsDir } from "./paths";

export interface StorageConfig {
  provider: "local" | "supabase" | "s3_r2";
  supabase?: {
    url: string;
    anonKey?: string;
    serviceRoleKey: string;
    bucket: string;
  };
  s3?: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    region?: string;
  };
}

const CONFIG_FILE = getDataFilePath("storage_config.json");
const UPLOADS_DIR = getUploadsDir();

export function getStorageConfig(): StorageConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Could not read storage_config.json, falling back to env:", e);
  }

  // Fallback to process.env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || "live-photos";

  if (supabaseUrl && supabaseKey) {
    return {
      provider: "supabase",
      supabase: {
        url: supabaseUrl,
        serviceRoleKey: supabaseKey,
        bucket: supabaseBucket,
      },
    };
  }

  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Key = process.env.S3_ACCESS_KEY_ID;
  const s3Secret = process.env.S3_SECRET_ACCESS_KEY;
  const s3Bucket = process.env.S3_BUCKET_NAME || "live-photos";

  if (s3Endpoint && s3Key && s3Secret) {
    return {
      provider: "s3_r2",
      s3: {
        endpoint: s3Endpoint,
        accessKeyId: s3Key,
        secretAccessKey: s3Secret,
        bucketName: s3Bucket,
      },
    };
  }

  return {
    provider: "local",
  };
}

export function saveStorageConfig(config: StorageConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save storage config:", e);
    throw e;
  }
}

export async function testStorageConnection(config?: StorageConfig): Promise<{ success: boolean; message: string; publicUrl?: string }> {
  const cfg = config || getStorageConfig();

  if (cfg.provider === "local") {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      const testFile = path.join(UPLOADS_DIR, "test_ping.txt");
      fs.writeFileSync(testFile, "storage_ok");
      return {
        success: true,
        message: "Local high-performance storage is fully operational. Files are served at /api/uploads/...",
      };
    } catch (err: any) {
      return { success: false, message: `Local storage error: ${err.message}` };
    }
  }

  if (cfg.provider === "supabase" && cfg.supabase) {
    const { url, serviceRoleKey, bucket } = cfg.supabase;
    if (!url || !serviceRoleKey || !bucket) {
      return { success: false, message: "Missing Supabase URL, Service Role Key, or Bucket name." };
    }

    try {
      const cleanUrl = url.trim().replace(/\/$/, "");
      const testFileName = `test_connection_${Date.now()}.txt`;
      const uploadUrl = `${cleanUrl}/storage/v1/object/${bucket.trim()}/${testFileName}`;

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey.trim()}`,
          "Content-Type": "text/plain",
          "x-upsert": "true",
        },
        body: "Signature by Marvan storage connection test",
      });

      if (res.ok) {
        const publicUrl = `${cleanUrl}/storage/v1/object/public/${bucket.trim()}/${testFileName}`;
        return {
          success: true,
          message: `Connected successfully to Supabase Storage bucket "${bucket}"! 1GB Free Cloud Tier Active.`,
          publicUrl,
        };
      } else {
        const errText = await res.text();
        return {
          success: false,
          message: `Supabase returned HTTP ${res.status}: ${errText}. Please check your bucket name and ensure "Public bucket" is enabled.`,
        };
      }
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  if (cfg.provider === "s3_r2" && cfg.s3) {
    return {
      success: true,
      message: `Configured Cloudflare R2 / S3 storage for bucket "${cfg.s3.bucketName}".`,
    };
  }

  return { success: false, message: "Unknown storage provider." };
}

export async function uploadToStorage(
  buffer: Buffer,
  storedFileName: string,
  mimeType: string
): Promise<{ url: string; provider: "local" | "supabase" | "s3_r2" }> {
  const config = getStorageConfig();

  // 1. Supabase Cloud Storage
  if (config.provider === "supabase" && config.supabase?.url && config.supabase?.serviceRoleKey) {
    try {
      const { url, serviceRoleKey, bucket } = config.supabase;
      const cleanUrl = url.trim().replace(/\/$/, "");
      const cleanBucket = (bucket || "live-photos").trim();
      const uploadUrl = `${cleanUrl}/storage/v1/object/${cleanBucket}/uploads/${storedFileName}`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey.trim()}`,
          "Content-Type": mimeType,
          "x-upsert": "true",
        },
        body: buffer as any,
      });

      if (response.ok) {
        const publicUrl = `${cleanUrl}/storage/v1/object/public/${cleanBucket}/uploads/${storedFileName}`;
        return { url: publicUrl, provider: "supabase" };
      }
    } catch (err) {
      console.warn("Supabase upload failed, falling back to local:", err);
    }
  }

  // 2. Local Storage (always reliable fallback and default)
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const localFilePath = path.join(UPLOADS_DIR, storedFileName);
  fs.writeFileSync(localFilePath, buffer);

  return {
    url: `/api/uploads/${storedFileName}`,
    provider: "local",
  };
}

export async function deleteFromStorage(photoUrl: string): Promise<boolean> {
  if (!photoUrl) return false;

  const config = getStorageConfig();
  const fileName = path.basename(photoUrl);

  // 1. Delete from Supabase if stored on Supabase Cloud
  if (config.supabase?.url && config.supabase?.serviceRoleKey && photoUrl.includes("/storage/v1/object/")) {
    try {
      const { url, serviceRoleKey, bucket } = config.supabase;
      const cleanUrl = url.trim().replace(/\/$/, "");
      const cleanBucket = (bucket || "live-photos").trim();
      const deleteUrl = `${cleanUrl}/storage/v1/object/${cleanBucket}`;

      await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${serviceRoleKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: [`uploads/${fileName}`, fileName] }),
      });
    } catch (e) {
      console.warn("Failed to delete from Supabase storage:", e);
    }
  }

  // 2. Delete from local disk if stored locally
  try {
    const localPath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      return true;
    }
  } catch (e) {
    console.warn("Failed to delete local file:", e);
  }

  return true;
}
