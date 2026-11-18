import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDataFilePath, getUploadsDir } from "./paths";

export interface StorageConfig {
  provider: "local" | "supabase" | "s3_r2" | "vercel_blob";
  blobToken?: string;
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
    publicUrl?: string;
  };
  kv?: {
    url: string;
    token: string;
  };
}

const CONFIG_FILE = getDataFilePath("storage_config.json");
const UPLOADS_DIR = getUploadsDir();

declare global {
  // eslint-disable-next-line no-var
  var __GLOBAL_STORAGE_CONFIG__: StorageConfig | undefined;
}

function normalizeEnvConfig(base: Partial<StorageConfig>): StorageConfig {
  const merged: StorageConfig = {
    provider: "local",
    ...base,
  };

  // Strip any accidental placeholder/test Supabase credentials
  if (
    merged.supabase?.url?.includes("xyz.supabase.co") ||
    merged.supabase?.serviceRoleKey === "secret_role_key_test_123"
  ) {
    merged.supabase = undefined;
    if (base.provider === "supabase") {
      base = { ...base, provider: undefined };
    }
  }

  const validProviders: ("local" | "supabase" | "s3_r2" | "vercel_blob")[] = [
    "local",
    "supabase",
    "s3_r2",
    "vercel_blob",
  ];
  const hasExplicitProvider = Boolean(base.provider && validProviders.includes(base.provider));

  // Merge Vercel Blob token from env if not explicitly set
  const envBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (envBlobToken && !merged.blobToken) {
    merged.blobToken = envBlobToken.trim();
  }

  // Merge Upstash / Vercel KV from env if not set
  const envKvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const envKvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (envKvUrl && envKvToken && (!merged.kv?.url || !merged.kv?.token)) {
    merged.kv = { url: envKvUrl.trim(), token: envKvToken.trim() };
  }

  // Merge Supabase from env if missing in saved config
  const envSupaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const envSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envSupaBucket = process.env.SUPABASE_STORAGE_BUCKET || "live-photos";
  if (envSupaUrl && envSupaKey && (!merged.supabase?.url || !merged.supabase?.serviceRoleKey)) {
    merged.supabase = {
      url: envSupaUrl.trim(),
      serviceRoleKey: envSupaKey.trim(),
      bucket: envSupaBucket.trim(),
    };
  }

  // Merge S3/R2 from env if missing keys
  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Key = process.env.S3_ACCESS_KEY_ID;
  const s3Secret = process.env.S3_SECRET_ACCESS_KEY;
  const s3Bucket = process.env.S3_BUCKET_NAME || "live-photos";
  const s3Public = process.env.S3_PUBLIC_URL;
  if (s3Endpoint && s3Key && s3Secret && (!merged.s3?.accessKeyId || !merged.s3?.secretAccessKey)) {
    merged.s3 = {
      endpoint: s3Endpoint.trim(),
      accessKeyId: s3Key.trim(),
      secretAccessKey: s3Secret.trim(),
      bucketName: s3Bucket.trim(),
      region: process.env.S3_REGION || "auto",
      publicUrl: s3Public?.trim() || merged.s3?.publicUrl,
    };
  }

  // Only if no valid provider was explicitly chosen, auto-activate the best permanent Cloud provider
  if (!hasExplicitProvider) {
    if (merged.blobToken) {
      merged.provider = "vercel_blob";
    } else if (merged.supabase?.url && merged.supabase?.serviceRoleKey) {
      merged.provider = "supabase";
    } else if (merged.s3?.endpoint && merged.s3?.accessKeyId && merged.s3?.secretAccessKey) {
      merged.provider = "s3_r2";
    } else {
      merged.provider = "local";
    }
  }

  return merged;
}

export function getStorageConfig(): StorageConfig {
  if (globalThis.__GLOBAL_STORAGE_CONFIG__) {
    return normalizeEnvConfig(globalThis.__GLOBAL_STORAGE_CONFIG__);
  }

  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ CONFIG_FILE)) {
      const data = fs.readFileSync(/*turbopackIgnore: true*/ CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(data) as Partial<StorageConfig>;
      const normalized = normalizeEnvConfig(parsed);
      globalThis.__GLOBAL_STORAGE_CONFIG__ = normalized;
      return normalized;
    }
  } catch (e) {
    console.warn("Could not read storage_config.json, falling back:", e);
  }

  // Check process.cwd()/data/storage_config.json as secondary disk source
  try {
    const cwdConfig = path.join(process.cwd(), "data", "storage_config.json");
    if (cwdConfig !== CONFIG_FILE && fs.existsSync(/*turbopackIgnore: true*/ cwdConfig)) {
      const parsed = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ cwdConfig, "utf-8")) as Partial<StorageConfig>;
      const normalized = normalizeEnvConfig(parsed);
      globalThis.__GLOBAL_STORAGE_CONFIG__ = normalized;
      return normalized;
    }
  } catch (_) {}

  const fallback = normalizeEnvConfig({});
  globalThis.__GLOBAL_STORAGE_CONFIG__ = fallback;
  return fallback;
}

export async function getStorageConfigAsync(): Promise<StorageConfig> {
  if (globalThis.__GLOBAL_STORAGE_CONFIG__) {
    return normalizeEnvConfig(globalThis.__GLOBAL_STORAGE_CONFIG__);
  }

  // 1. Try reading from active Cloud DB (KV / Supabase / Blob manifest)
  try {
    const { cloudReadConfig } = await import("./cloudDb");
    const cloudCfg = await cloudReadConfig<StorageConfig>("storage_config");
    if (cloudCfg && cloudCfg.provider) {
      const normalized = normalizeEnvConfig(cloudCfg);
      globalThis.__GLOBAL_STORAGE_CONFIG__ = normalized;
      return normalized;
    }
  } catch (_) {}

  // 2. Fall back to local synchronous disk config
  return getStorageConfig();
}

export function saveStorageConfig(config: StorageConfig): void {
  const normalized = normalizeEnvConfig(config);
  globalThis.__GLOBAL_STORAGE_CONFIG__ = normalized;

  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
    fs.writeFileSync(/*turbopackIgnore: true*/ CONFIG_FILE, JSON.stringify(normalized, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not write storage config to tmp/data:", e);
  }

  try {
    const cwdFile = path.join(process.cwd(), "data", "storage_config.json");
    if (cwdFile !== CONFIG_FILE) {
      const cwdDir = path.dirname(cwdFile);
      if (!fs.existsSync(/*turbopackIgnore: true*/ cwdDir)) {
        fs.mkdirSync(/*turbopackIgnore: true*/ cwdDir, { recursive: true });
      }
      fs.writeFileSync(/*turbopackIgnore: true*/ cwdFile, JSON.stringify(normalized, null, 2), "utf-8");
    }
  } catch (_) {}
}

export async function saveStorageConfigAsync(config: StorageConfig): Promise<void> {
  saveStorageConfig(config);
  try {
    const { cloudWriteConfig } = await import("./cloudDb");
    await cloudWriteConfig("storage_config", normalizeEnvConfig(config));
  } catch (e) {
    console.warn("Could not persist storage config to Cloud DB:", e);
  }
}

// =========================================================================
// Pure Node AWS Signature V4 Helper (Cloudflare R2 & AWS S3 Compatible)
// =========================================================================
function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

export async function s3SignedFetch(
  s3: NonNullable<StorageConfig["s3"]>,
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  objectKey: string,
  body?: Buffer | string,
  contentType?: string
): Promise<Response> {
  const cleanEndpoint = s3.endpoint.trim().replace(/\/$/, "");
  const cleanBucket = (s3.bucketName || "live-photos").trim();
  const cleanKey = objectKey.replace(/^\/+/, "");
  const region = (s3.region || "auto").trim();
  const accessKeyId = s3.accessKeyId.trim();
  const secretAccessKey = s3.secretAccessKey.trim();

  const targetUrl = `${cleanEndpoint}/${cleanBucket}/${cleanKey}`;
  const urlObj = new URL(targetUrl);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadBuf = body ? (typeof body === "string" ? Buffer.from(body, "utf-8") : body) : Buffer.alloc(0);
  const payloadHash = sha256Hex(payloadBuf);

  const canonicalUri = urlObj.pathname
    .split("/")
    .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
    .join("/");

  const headerMap: Record<string, string> = {
    host: urlObj.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) {
    headerMap["content-type"] = contentType;
  }

  const sortedHeaderKeys = Object.keys(headerMap).sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headerMap[k]}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: authorization,
  };
  if (contentType) {
    fetchHeaders["Content-Type"] = contentType;
  }

  return fetch(targetUrl, {
    method,
    headers: fetchHeaders,
    body: method === "PUT" ? (payloadBuf as any) : undefined,
    cache: "no-store",
  });
}

export async function testStorageConnection(
  config?: StorageConfig
): Promise<{ success: boolean; message: string; publicUrl?: string }> {
  const cfg = config || getStorageConfig();

  if (cfg.provider === "vercel_blob") {
    const token = cfg.blobToken || process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return { success: false, message: "Missing Vercel Blob Read/Write Token (BLOB_READ_WRITE_TOKEN)." };
    }
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put("_db/healthcheck.txt", "ok", {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
      return {
        success: true,
        message: "Vercel Blob CDN & State Storage connected cleanly.",
        publicUrl: blob.url,
      };
    } catch (err: any) {
      return { success: false, message: `Vercel Blob error: ${err.message}` };
    }
  }

  if (cfg.provider === "local") {
    try {
      if (!fs.existsSync(/*turbopackIgnore: true*/ UPLOADS_DIR)) {
        fs.mkdirSync(/*turbopackIgnore: true*/ UPLOADS_DIR, { recursive: true });
      }
      const testFile = path.join(UPLOADS_DIR, "test_ping.txt");
      fs.writeFileSync(/*turbopackIgnore: true*/ testFile, "storage_ok");
      return {
        success: true,
        message: process.env.VERCEL
          ? "Local storage active (/tmp storage on serverless). Recommended: connect Supabase, Upstash KV, or R2 for permanent cloud persistence across instances."
          : "Local high-performance storage is active. Photos are served at /api/uploads/...",
      };
    } catch (err: any) {
      return { success: false, message: `Local storage error: ${err.message}` };
    }
  }

  if (cfg.provider === "supabase") {
    if (!cfg.supabase?.url || !cfg.supabase?.serviceRoleKey || !cfg.supabase?.bucket) {
      return { success: false, message: "Missing Supabase URL, Service Role Key, or Bucket name." };
    }

    try {
      const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
      const cleanBucket = cfg.supabase.bucket.trim();
      const testFileName = `_db/test_connection.txt`;
      const uploadUrl = `${cleanUrl}/storage/v1/object/${cleanBucket}/${testFileName}`;

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          apikey: cfg.supabase.serviceRoleKey.trim(),
          Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
          "Content-Type": "text/plain",
          "x-upsert": "true",
        },
        body: "Signature by Marvan storage connection test",
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const publicUrl = `${cleanUrl}/storage/v1/object/public/${cleanBucket}/${testFileName}`;
        return {
          success: true,
          message: `Connected to Supabase Storage "${cleanBucket}"! Cloud Sync is operational.`,
          publicUrl,
        };
      } else {
        const errText = await res.text();
        return {
          success: false,
          message: `Supabase returned HTTP ${res.status}: ${errText.slice(0, 200)}. Ensure bucket "${cleanBucket}" exists and has Public access ON.`,
        };
      }
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  if (cfg.provider === "s3_r2") {
    if (!cfg.s3?.endpoint || !cfg.s3?.accessKeyId || !cfg.s3?.secretAccessKey || !cfg.s3?.bucketName) {
      return {
        success: false,
        message: `R2 / S3 requires Endpoint, Access Key ID, Secret Access Key, and Bucket Name.`,
      };
    }
    try {
      const res = await s3SignedFetch(cfg.s3, "PUT", "_db/test_connection.txt", "r2_ok", "text/plain");
      if (res.ok) {
        return {
          success: true,
          message: `Connected & verified Cloudflare R2 / S3 bucket "${cfg.s3.bucketName}" via AWS SigV4!`,
        };
      } else {
        const errText = await res.text();
        return {
          success: false,
          message: `R2 / S3 returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
        };
      }
    } catch (err: any) {
      return { success: false, message: `R2 connection failed: ${err.message}` };
    }
  }

  return { success: false, message: "Unknown storage provider." };
}

export async function uploadToStorage(
  buffer: Buffer,
  storedFileName: string,
  mimeType: string
): Promise<{ url: string; provider: "local" | "supabase" | "s3_r2" | "vercel_blob" }> {
  const config = getStorageConfig();
  const provider = config.provider;

  // 1. Explicit Vercel Blob
  if (provider === "vercel_blob") {
    const blobToken = config.blobToken || process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(`uploads/${storedFileName}`, buffer, {
          access: "public",
          contentType: mimeType,
          token: blobToken,
        });
        return { url: blob.url, provider: "vercel_blob" };
      } catch (err) {
        console.warn("Vercel Blob upload failed, falling back to local:", err);
      }
    }
  }

  // 2. Explicit Supabase Cloud Storage
  if (provider === "supabase" && config.supabase?.url && config.supabase?.serviceRoleKey) {
    try {
      const { url, serviceRoleKey, bucket } = config.supabase;
      const cleanUrl = url.trim().replace(/\/$/, "");
      const cleanBucket = (bucket || "live-photos").trim();
      const uploadUrl = `${cleanUrl}/storage/v1/object/${cleanBucket}/uploads/${storedFileName}`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey.trim(),
          Authorization: `Bearer ${serviceRoleKey.trim()}`,
          "Content-Type": mimeType,
          "x-upsert": "true",
        },
        body: buffer as any,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const publicUrl = `${cleanUrl}/storage/v1/object/public/${cleanBucket}/uploads/${storedFileName}`;
        return { url: publicUrl, provider: "supabase" };
      } else {
        const errText = await response.text().catch(() => "");
        console.warn(`Supabase upload HTTP ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.warn("Supabase upload failed, falling back to local:", err);
    }
  }

  // 3. Explicit Cloudflare R2 / S3 Object Storage (AWS SigV4)
  if (
    provider === "s3_r2" &&
    config.s3?.endpoint &&
    config.s3?.accessKeyId &&
    config.s3?.secretAccessKey
  ) {
    try {
      const res = await s3SignedFetch(config.s3, "PUT", `uploads/${storedFileName}`, buffer, mimeType);
      if (res.ok) {
        const publicBase = config.s3.publicUrl?.trim().replace(/\/$/, "");
        const url = publicBase
          ? `${publicBase}/uploads/${storedFileName}`
          : `/api/uploads/${storedFileName}`;
        return { url, provider: "s3_r2" };
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`S3/R2 upload HTTP ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.warn("R2 / S3 upload failed, falling back to local:", err);
    }
  }

  // 4. Local Disk Storage (Resilient Default and Cloud Fallback)
  if (!fs.existsSync(/*turbopackIgnore: true*/ UPLOADS_DIR)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ UPLOADS_DIR, { recursive: true });
  }
  const localFilePath = path.join(UPLOADS_DIR, storedFileName);
  fs.writeFileSync(/*turbopackIgnore: true*/ localFilePath, buffer);

  return {
    url: `/api/uploads/${storedFileName}`,
    provider: "local",
  };
}

/**
 * Fetches an uploaded binary file from active cloud storage (used as proxy fallback in /api/uploads/[filename])
 */
export async function fetchFromCloudStorage(storedFileName: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const config = getStorageConfig();

  if (config.s3?.endpoint && config.s3?.accessKeyId && config.s3?.secretAccessKey) {
    try {
      const res = await s3SignedFetch(config.s3, "GET", `uploads/${storedFileName}`);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        return {
          buffer: Buffer.from(arr),
          contentType: res.headers.get("content-type") || "image/jpeg",
        };
      }
    } catch (_) {}
  }

  if (config.supabase?.url && config.supabase?.serviceRoleKey) {
    try {
      const cleanUrl = config.supabase.url.trim().replace(/\/$/, "");
      const cleanBucket = (config.supabase.bucket || "live-photos").trim();
      const res = await fetch(`${cleanUrl}/storage/v1/object/authenticated/${cleanBucket}/uploads/${storedFileName}`, {
        headers: {
          apikey: config.supabase.serviceRoleKey.trim(),
          Authorization: `Bearer ${config.supabase.serviceRoleKey.trim()}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        return {
          buffer: Buffer.from(arr),
          contentType: res.headers.get("content-type") || "image/jpeg",
        };
      }
    } catch (_) {}
  }

  return null;
}

export async function deleteFromStorage(photoUrl: string): Promise<boolean> {
  if (!photoUrl) return false;

  const config = getStorageConfig();
  const fileName = path.basename(photoUrl);

  // 1. Delete from Vercel Blob
  const blobToken = config.blobToken || process.env.BLOB_READ_WRITE_TOKEN;
  if (photoUrl.includes("vercel-storage.com") && blobToken) {
    try {
      const { del } = await import("@vercel/blob");
      await del(photoUrl, { token: blobToken });
      return true;
    } catch (e) {
      console.warn("Failed to delete from Vercel Blob:", e);
    }
  }

  // 2. Delete from Supabase Storage
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

  // 3. Delete from R2 / S3
  if (config.s3?.endpoint && config.s3?.accessKeyId && config.s3?.secretAccessKey) {
    try {
      await s3SignedFetch(config.s3, "DELETE", `uploads/${fileName}`);
    } catch (e) {
      console.warn("Failed to delete from S3/R2:", e);
    }
  }

  // 4. Delete from local disk
  try {
    const localPath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
      fs.unlinkSync(/*turbopackIgnore: true*/ localPath);
      return true;
    }
  } catch (e) {
    console.warn("Failed to delete local file:", e);
  }

  return true;
}
