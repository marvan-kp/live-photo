import { getStorageConfig, s3SignedFetch, StorageConfig } from "./cloudStorage";

export type CloudDbEngine =
  | "upstash_kv"
  | "supabase_postgres"
  | "supabase_bucket"
  | "vercel_blob"
  | "s3_r2"
  | "local_ephemeral";

export const SUPABASE_SETUP_SQL = `-- Run in Supabase SQL Editor for instant Postgres atomic sync:
CREATE TABLE IF NOT EXISTS lps_events (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lps_photos (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  likes INTEGER DEFAULT 0,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lps_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`;

declare global {
  // eslint-disable-next-line no-var
  var __LPS_SUPA_PG_CACHE__: { url: string; available: boolean; checkedAt: number } | undefined;
}

async function kvCommand<T = any>(url: string, token: string, args: (string | number)[]): Promise<T | null> {
  const cleanUrl = url.trim().replace(/\/$/, "");
  const res = await fetch(cleanUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`KV HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.result ?? null;
}

export async function testKvConnection(url: string, token: string): Promise<{ ok: boolean; message: string }> {
  if (!url?.trim() || !token?.trim()) {
    return { ok: false, message: "KV REST URL and Token are required." };
  }
  try {
    const res = await kvCommand<string>(url, token, ["PING"]);
    if (res === "PONG" || res) {
      return { ok: true, message: "Upstash Redis / Vercel KV connected! Atomic multi-device DB sync active." };
    }
    return { ok: false, message: "Unexpected KV PING response." };
  } catch (err: any) {
    return { ok: false, message: `KV connection failed: ${err.message}` };
  }
}

export async function isSupabasePostgresReady(
  supaUrl: string,
  serviceRoleKey: string,
  forceRefresh = false
): Promise<boolean> {
  const cached = globalThis.__LPS_SUPA_PG_CACHE__;
  if (!forceRefresh && cached && cached.url === supaUrl && Date.now() - cached.checkedAt < 60_000) {
    return cached.available;
  }

  try {
    const cleanUrl = supaUrl.trim().replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/rest/v1/lps_events?select=id&limit=1`, {
      headers: {
        apikey: serviceRoleKey.trim(),
        Authorization: `Bearer ${serviceRoleKey.trim()}`,
      },
      cache: "no-store",
    });
    const available = res.ok;
    globalThis.__LPS_SUPA_PG_CACHE__ = { url: supaUrl, available, checkedAt: Date.now() };
    return available;
  } catch {
    return false;
  }
}

export async function detectActiveEngine(cfgOverride?: StorageConfig): Promise<CloudDbEngine> {
  const cfg = cfgOverride || getStorageConfig();

  if (cfg.kv?.url && cfg.kv?.token) {
    return "upstash_kv";
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    return pgReady ? "supabase_postgres" : "supabase_bucket";
  }

  if (cfg.blobToken || process.env.BLOB_READ_WRITE_TOKEN) {
    return "vercel_blob";
  }

  if (cfg.s3?.endpoint && cfg.s3?.accessKeyId && cfg.s3?.secretAccessKey) {
    return "s3_r2";
  }

  return "local_ephemeral";
}

export async function getCloudHealthReport() {
  const cfg = getStorageConfig();
  const engine = await detectActiveEngine(cfg);

  const labels: Record<CloudDbEngine, string> = {
    upstash_kv: "Upstash Redis / Vercel KV (Atomic)",
    supabase_postgres: "Supabase PostgreSQL Tables (Atomic)",
    supabase_bucket: "Supabase Cloud Storage Sync",
    vercel_blob: "Vercel Blob Global Manifest Sync",
    s3_r2: "Cloudflare R2 / S3 Cloud Sync",
    local_ephemeral: process.env.VERCEL ? "Vercel Local /tmp (Ephemeral)" : "Local Disk Storage",
  };

  return {
    engine,
    label: labels[engine],
    isPersistent: engine !== "local_ephemeral",
    kvConfigured: Boolean(cfg.kv?.url && cfg.kv?.token),
    supabaseConfigured: Boolean(cfg.supabase?.url && cfg.supabase?.serviceRoleKey),
    supabasePostgresReady:
      cfg.supabase?.url && cfg.supabase?.serviceRoleKey
        ? await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey, true)
        : false,
    blobConfigured: Boolean(cfg.blobToken || process.env.BLOB_READ_WRITE_TOKEN),
    r2Configured: Boolean(cfg.s3?.endpoint && cfg.s3?.accessKeyId && cfg.s3?.secretAccessKey),
  };
}

// =========================================================================
// Generic JSON Manifest Helpers (Blob / Supabase Storage / R2)
// =========================================================================
async function readJsonManifest<T>(filename: string, cfg: StorageConfig): Promise<T | null> {
  // 1. Supabase Storage Bucket (_db/filename)
  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    try {
      const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
      const cleanBucket = (cfg.supabase.bucket || "live-photos").trim();
      const res = await fetch(`${cleanUrl}/storage/v1/object/authenticated/${cleanBucket}/_db/${filename}`, {
        headers: {
          apikey: cfg.supabase.serviceRoleKey.trim(),
          Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch (_) {}
  }

  // 2. Vercel Blob (_db/filename)
  const blobToken = cfg.blobToken || process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: `_db/${filename}`, token: blobToken });
      const exact = blobs.find((b) => b.pathname === `_db/${filename}`) || blobs[0];
      if (exact?.url) {
        const res = await fetch(`${exact.url}?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          return (await res.json()) as T;
        }
      }
    } catch (_) {}
  }

  // 3. Cloudflare R2 / S3 (_db/filename)
  if (cfg.s3?.endpoint && cfg.s3?.accessKeyId && cfg.s3?.secretAccessKey) {
    try {
      const res = await s3SignedFetch(cfg.s3, "GET", `_db/${filename}`);
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch (_) {}
  }

  return null;
}

async function writeJsonManifest<T>(filename: string, data: T, cfg: StorageConfig): Promise<boolean> {
  const payload = JSON.stringify(data, null, 2);
  let wrote = false;

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    try {
      const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
      const cleanBucket = (cfg.supabase.bucket || "live-photos").trim();
      const res = await fetch(`${cleanUrl}/storage/v1/object/${cleanBucket}/_db/${filename}`, {
        method: "POST",
        headers: {
          apikey: cfg.supabase.serviceRoleKey.trim(),
          Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
          "Content-Type": "application/json",
          "x-upsert": "true",
        },
        body: payload,
      });
      if (res.ok) wrote = true;
    } catch (e) {
      console.warn(`Supabase _db/${filename} write failed:`, e);
    }
  }

  const blobToken = cfg.blobToken || process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const { put } = await import("@vercel/blob");
      await put(`_db/${filename}`, payload, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        token: blobToken,
      });
      wrote = true;
    } catch (e) {
      console.warn(`Vercel Blob _db/${filename} write failed:`, e);
    }
  }

  if (cfg.s3?.endpoint && cfg.s3?.accessKeyId && cfg.s3?.secretAccessKey) {
    try {
      const res = await s3SignedFetch(cfg.s3, "PUT", `_db/${filename}`, payload, "application/json");
      if (res.ok) wrote = true;
    } catch (e) {
      console.warn(`R2 _db/${filename} write failed:`, e);
    }
  }

  return wrote;
}

// =========================================================================
// EVENTS Sync (Atomic Hash/Postgres + Manifest Fallback)
// =========================================================================
export async function cloudReadEvents<T extends { id: string }>(): Promise<T[] | null> {
  const cfg = getStorageConfig();

  // 1. Upstash / Vercel KV
  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      const raw = await kvCommand<string[] | Record<string, string>>(cfg.kv.url, cfg.kv.token, ["HGETALL", "lps:events"]);
      if (Array.isArray(raw) && raw.length > 0) {
        const list: T[] = [];
        for (let i = 0; i < raw.length; i += 2) {
          try {
            list.push(JSON.parse(raw[i + 1]));
          } catch (_) {}
        }
        return list;
      }
      if (raw && !Array.isArray(raw) && typeof raw === "object") {
        const list: T[] = [];
        for (const val of Object.values(raw)) {
          try {
            list.push(typeof val === "string" ? JSON.parse(val) : (val as T));
          } catch (_) {}
        }
        return list;
      }
      return [];
    } catch (e) {
      console.warn("KV cloudReadEvents failed:", e);
    }
  }

  // 2. Supabase Postgres
  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/rest/v1/lps_events?select=data`, {
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
          },
          cache: "no-store",
        });
        if (res.ok) {
          const rows = (await res.json()) as { data: T }[];
          return rows.map((r) => r.data);
        }
      } catch (e) {
        console.warn("Supabase Postgres readEvents failed:", e);
      }
    }
  }

  // 3. Manifest (Supabase Bucket / Vercel Blob / R2)
  return await readJsonManifest<T[]>("events.json", cfg);
}

export async function cloudUpsertEvent<T extends { id: string }>(event: T): Promise<void> {
  const cfg = getStorageConfig();

  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      await kvCommand(cfg.kv.url, cfg.kv.token, ["HSET", "lps:events", event.id, JSON.stringify(event)]);
      return;
    } catch (e) {
      console.warn("KV upsertEvent failed:", e);
    }
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        await fetch(`${cleanUrl}/rest/v1/lps_events`, {
          method: "POST",
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            id: event.id,
            data: event,
            updated_at: new Date().toISOString(),
          }),
        });
        return;
      } catch (e) {
        console.warn("Supabase Postgres upsertEvent failed:", e);
      }
    }
  }

  const existing = (await readJsonManifest<T[]>("events.json", cfg)) || [];
  const idx = existing.findIndex((e) => e.id === event.id);
  if (idx >= 0) existing[idx] = event;
  else existing.unshift(event);
  await writeJsonManifest("events.json", existing, cfg);
}

export async function cloudDeleteEvent(id: string): Promise<void> {
  const cfg = getStorageConfig();

  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      await kvCommand(cfg.kv.url, cfg.kv.token, ["HDEL", "lps:events", id]);
    } catch (_) {}
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        await fetch(`${cleanUrl}/rest/v1/lps_events?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
          },
        });
        return;
      } catch (_) {}
    }
  }

  const existing = await readJsonManifest<{ id: string }[]>("events.json", cfg);
  if (existing) {
    await writeJsonManifest("events.json", existing.filter((e) => e.id !== id), cfg);
  }
}

export async function cloudWriteAllEvents<T extends { id: string }>(events: T[]): Promise<boolean> {
  const cfg = getStorageConfig();
  let ok = false;

  if (cfg.kv?.url && cfg.kv?.token && events.length > 0) {
    try {
      const args: string[] = ["HSET", "lps:events"];
      for (const ev of events) {
        args.push(ev.id, JSON.stringify(ev));
      }
      await kvCommand(cfg.kv.url, cfg.kv.token, args);
      ok = true;
    } catch (e) {
      console.warn("KV writeAllEvents failed:", e);
    }
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady && events.length > 0) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        const rows = events.map((ev) => ({
          id: ev.id,
          data: ev,
          updated_at: new Date().toISOString(),
        }));
        const res = await fetch(`${cleanUrl}/rest/v1/lps_events`, {
          method: "POST",
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(rows),
        });
        if (res.ok) ok = true;
      } catch (e) {
        console.warn("Supabase writeAllEvents failed:", e);
      }
    }
  }

  const manifestOk = await writeJsonManifest("events.json", events, cfg);
  return ok || manifestOk;
}

// =========================================================================
// PHOTOS Sync (Atomic Hash/Postgres + Manifest Fallback)
// =========================================================================
export async function cloudReadPhotos<T extends { id: string }>(): Promise<T[] | null> {
  const cfg = getStorageConfig();

  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      const raw = await kvCommand<string[] | Record<string, string>>(cfg.kv.url, cfg.kv.token, ["HGETALL", "lps:photos"]);
      if (Array.isArray(raw) && raw.length > 0) {
        const list: T[] = [];
        for (let i = 0; i < raw.length; i += 2) {
          try {
            list.push(JSON.parse(raw[i + 1]));
          } catch (_) {}
        }
        return list;
      }
      if (raw && !Array.isArray(raw) && typeof raw === "object") {
        const list: T[] = [];
        for (const val of Object.values(raw)) {
          try {
            list.push(typeof val === "string" ? JSON.parse(val) : (val as T));
          } catch (_) {}
        }
        return list;
      }
      return [];
    } catch (e) {
      console.warn("KV cloudReadPhotos failed:", e);
    }
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/rest/v1/lps_photos?select=data`, {
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
          },
          cache: "no-store",
        });
        if (res.ok) {
          const rows = (await res.json()) as { data: T }[];
          return rows.map((r) => r.data);
        }
      } catch (e) {
        console.warn("Supabase Postgres readPhotos failed:", e);
      }
    }
  }

  return await readJsonManifest<T[]>("photos.json", cfg);
}

export async function cloudUpsertPhoto<T extends { id: string; eventId?: string; likes?: number; createdAt?: string }>(
  photo: T
): Promise<void> {
  const cfg = getStorageConfig();

  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      await kvCommand(cfg.kv.url, cfg.kv.token, ["HSET", "lps:photos", photo.id, JSON.stringify(photo)]);
      return;
    } catch (e) {
      console.warn("KV upsertPhoto failed:", e);
    }
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        await fetch(`${cleanUrl}/rest/v1/lps_photos`, {
          method: "POST",
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            id: photo.id,
            event_id: photo.eventId || null,
            likes: photo.likes || 0,
            data: photo,
            created_at: photo.createdAt || new Date().toISOString(),
          }),
        });
        return;
      } catch (e) {
        console.warn("Supabase Postgres upsertPhoto failed:", e);
      }
    }
  }

  const existing = (await readJsonManifest<T[]>("photos.json", cfg)) || [];
  const idx = existing.findIndex((p) => p.id === photo.id);
  if (idx >= 0) existing[idx] = photo;
  else existing.unshift(photo);
  await writeJsonManifest("photos.json", existing, cfg);
}

export async function cloudDeletePhoto(id: string): Promise<void> {
  const cfg = getStorageConfig();

  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      await kvCommand(cfg.kv.url, cfg.kv.token, ["HDEL", "lps:photos", id]);
    } catch (_) {}
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        await fetch(`${cleanUrl}/rest/v1/lps_photos?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
          },
        });
        return;
      } catch (_) {}
    }
  }

  const existing = await readJsonManifest<{ id: string }[]>("photos.json", cfg);
  if (existing) {
    await writeJsonManifest("photos.json", existing.filter((p) => p.id !== id), cfg);
  }
}

export async function cloudWriteAllPhotos<T extends { id: string; eventId?: string; likes?: number; createdAt?: string }>(
  photos: T[]
): Promise<boolean> {
  const cfg = getStorageConfig();
  let ok = false;

  if (cfg.kv?.url && cfg.kv?.token && photos.length > 0) {
    try {
      const args: string[] = ["HSET", "lps:photos"];
      for (const p of photos) {
        args.push(p.id, JSON.stringify(p));
      }
      await kvCommand(cfg.kv.url, cfg.kv.token, args);
      ok = true;
    } catch (e) {
      console.warn("KV writeAllPhotos failed:", e);
    }
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady && photos.length > 0) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        const rows = photos.map((p) => ({
          id: p.id,
          event_id: p.eventId || null,
          likes: p.likes || 0,
          data: p,
          created_at: p.createdAt || new Date().toISOString(),
        }));
        const res = await fetch(`${cleanUrl}/rest/v1/lps_photos`, {
          method: "POST",
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(rows),
        });
        if (res.ok) ok = true;
      } catch (e) {
        console.warn("Supabase writeAllPhotos failed:", e);
      }
    }
  }

  const manifestOk = await writeJsonManifest("photos.json", photos, cfg);
  return ok || manifestOk;
}

// =========================================================================
// KV / Config Sync (watermark_config, culling_config, etc.)
// =========================================================================
export async function cloudReadConfig<T>(key: string): Promise<T | null> {
  const cfg = getStorageConfig();

  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      const raw = await kvCommand<string>(cfg.kv.url, cfg.kv.token, ["GET", `lps:kv:${key}`]);
      if (raw) {
        return typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as T);
      }
    } catch (_) {}
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/rest/v1/lps_kv?key=eq.${encodeURIComponent(key)}&select=value`, {
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
          },
          cache: "no-store",
        });
        if (res.ok) {
          const rows = (await res.json()) as { value: T }[];
          if (rows[0]?.value) return rows[0].value;
        }
      } catch (_) {}
    }
  }

  return await readJsonManifest<T>(`${key}.json`, cfg);
}

export async function cloudWriteConfig<T>(key: string, data: T): Promise<boolean> {
  const cfg = getStorageConfig();
  let ok = false;

  if (cfg.kv?.url && cfg.kv?.token) {
    try {
      await kvCommand(cfg.kv.url, cfg.kv.token, ["SET", `lps:kv:${key}`, JSON.stringify(data)]);
      ok = true;
    } catch (_) {}
  }

  if (cfg.supabase?.url && cfg.supabase?.serviceRoleKey) {
    const pgReady = await isSupabasePostgresReady(cfg.supabase.url, cfg.supabase.serviceRoleKey);
    if (pgReady) {
      try {
        const cleanUrl = cfg.supabase.url.trim().replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/rest/v1/lps_kv`, {
          method: "POST",
          headers: {
            apikey: cfg.supabase.serviceRoleKey.trim(),
            Authorization: `Bearer ${cfg.supabase.serviceRoleKey.trim()}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            key,
            value: data,
            updated_at: new Date().toISOString(),
          }),
        });
        if (res.ok) ok = true;
      } catch (_) {}
    }
  }

  const manifestOk = await writeJsonManifest(`${key}.json`, data, cfg);
  return ok || manifestOk;
}
