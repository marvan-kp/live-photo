import fs from 'fs';
import path from 'path';
import { incrementPhotoCount, incrementPhotoCountAsync } from './events';
import { uploadToStorage, deleteFromStorage } from './cloudStorage';
import { getDataFilePath, getUploadsDir } from './paths';
import {
  cloudReadPhotos,
  cloudUpsertPhoto,
  cloudDeletePhoto,
  cloudWriteAllPhotos,
} from './cloudDb';

export interface StoredFile {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
  createdAt: string;
  provider: 'supabase' | 'r2_s3' | 'local_file' | 'local_fallback' | 'vercel_blob';
  eventId?: string;
  guestName?: string;
  caption?: string;
  likes: number;
  qualityScore?: number;
  cullStatus?: 'approved' | 'blurry' | 'blink' | 'duplicate' | 'underexposed' | 'overexposed';
  isCulled?: boolean;
  aiReason?: string;
  burstGroupId?: string;
}

const DATA_FILE = getDataFilePath('photos.json');
const UPLOADS_DIR = getUploadsDir();

declare global {
  // eslint-disable-next-line no-var
  var __GLOBAL_PHOTOS__: StoredFile[] | undefined;
}

export function loadPhotos(): Map<string, StoredFile> {
  const map = new Map<string, StoredFile>();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed: StoredFile[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach(p => map.set(p.id, p));
      }
    }
  } catch (e) {
    console.warn('Could not read photos data file:', e);
  }

  // Merge with in-memory global cache across lambda warm invocations
  const inMemory = globalThis.__GLOBAL_PHOTOS__ || [];
  inMemory.forEach(p => {
    if (!map.has(p.id)) {
      map.set(p.id, p);
    } else {
      const existing = map.get(p.id)!;
      map.set(p.id, {
        ...existing,
        ...p,
        likes: Math.max(p.likes || 0, existing.likes || 0),
      });
    }
  });

  return map;
}

export function savePhotos(photos: StoredFile[]) {
  globalThis.__GLOBAL_PHOTOS__ = photos;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(photos, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not save photos to disk:', e);
  }

  try {
    const cwdFile = path.join(process.cwd(), "data", "photos.json");
    if (cwdFile !== DATA_FILE) {
      const cwdDir = path.dirname(cwdFile);
      if (!fs.existsSync(cwdDir)) fs.mkdirSync(cwdDir, { recursive: true });
      fs.writeFileSync(cwdFile, JSON.stringify(photos, null, 2), "utf-8");
    }
  } catch (_) {}
}

export async function savePhotosAsync(photos: StoredFile[]): Promise<void> {
  savePhotos(photos);
  await cloudWriteAllPhotos(photos);
}

/**
 * Cloud-backed async reader: Reads directly from active Cloud DB (Upstash KV / Supabase / Blob / R2),
 * merges cleanly, and falls back to local disk + global cache.
 */
export async function loadPhotosAsync(): Promise<Map<string, StoredFile>> {
  try {
    const cloudList = await cloudReadPhotos<StoredFile>();
    if (Array.isArray(cloudList)) {
      if (cloudList.length > 0) {
        savePhotos(cloudList);
        const map = new Map<string, StoredFile>();
        cloudList.forEach(p => map.set(p.id, p));
        return map;
      }
      // If Cloud DB is connected and completely empty, seed it with local photos
      const localMap = loadPhotos();
      const localArr = Array.from(localMap.values());
      if (localArr.length > 0) {
        await cloudWriteAllPhotos(localArr);
      }
      return localMap;
    }
  } catch (e) {
    console.warn('Cloud loadPhotosAsync fallback:', e);
  }
  return loadPhotos();
}

export async function uploadFileToCloud(
  buffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string = 'image/jpeg',
  eventId?: string,
  guestName?: string,
  caption?: string,
  thumbnailBuffer?: Buffer | Uint8Array,
  qualityData?: {
    qualityScore?: number;
    cullStatus?: 'approved' | 'blurry' | 'blink' | 'duplicate' | 'underexposed' | 'overexposed';
    isCulled?: boolean;
    aiReason?: string;
  }
): Promise<StoredFile> {
  const fileId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const cleanExt = path.extname(fileName) || '.jpg';
  const cleanBase = path.basename(fileName, cleanExt).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storedFileName = `${fileId}_${cleanBase}${cleanExt}`;

  const buf = Buffer.from(buffer);

  const result = await uploadToStorage(buf, storedFileName, mimeType);

  let thumbUrl = result.url;
  if (thumbnailBuffer) {
    try {
      const thumbFileName = `thumb_${storedFileName}`;
      const thumbResult = await uploadToStorage(Buffer.from(thumbnailBuffer), thumbFileName, 'image/jpeg');
      thumbUrl = thumbResult.url;
    } catch (e) {
      console.warn('Could not save thumbnail, using original:', e);
    }
  }

  const record: StoredFile = {
    id: fileId,
    name: fileName,
    url: result.url,
    thumbnailUrl: thumbUrl,
    size: buf.length,
    mimeType,
    createdAt: new Date().toISOString(),
    provider: result.provider === 'supabase' ? 'supabase' : result.provider === 's3_r2' ? 'r2_s3' : result.provider === 'vercel_blob' ? 'vercel_blob' : 'local_file',
    eventId: eventId || 'marvan-live-2026',
    guestName: guestName || 'Guest',
    caption: caption || '',
    likes: 0,
    qualityScore: qualityData?.qualityScore ?? 85,
    cullStatus: qualityData?.cullStatus ?? 'approved',
    isCulled: qualityData?.isCulled ?? false,
    aiReason: qualityData?.aiReason ?? 'Crisp Focus & Great Moment ⭐'
  };

  const map = await loadPhotosAsync();
  map.set(fileId, record);
  savePhotos(Array.from(map.values()));
  await cloudUpsertPhoto(record);

  if (eventId) {
    await incrementPhotoCountAsync(eventId).catch(() => incrementPhotoCount(eventId));
  }
  return record;
}

export function listStoredFiles(eventId?: string): StoredFile[] {
  const map = loadPhotos();
  let files = Array.from(map.values());
  if (eventId) {
    const cleanId = eventId.trim().toLowerCase();
    files = files.filter(f => f.eventId?.toLowerCase() === cleanId);
  }
  return files.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function listStoredFilesAsync(eventId?: string): Promise<StoredFile[]> {
  const map = await loadPhotosAsync();
  let files = Array.from(map.values());
  if (eventId) {
    const cleanId = eventId.trim().toLowerCase();
    files = files.filter(f => f.eventId?.toLowerCase() === cleanId);
  }
  return files.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getStoredFile(id: string): StoredFile | undefined {
  const map = loadPhotos();
  return map.get(id);
}

export function likePhoto(id: string): StoredFile | null {
  const map = loadPhotos();
  const photo = map.get(id);
  if (!photo) return null;
  photo.likes = (photo.likes || 0) + 1;
  savePhotos(Array.from(map.values()));
  cloudUpsertPhoto(photo).catch(() => {});
  return photo;
}

export async function likePhotoAsync(id: string): Promise<StoredFile | null> {
  const map = await loadPhotosAsync();
  const photo = map.get(id);
  if (!photo) return null;
  photo.likes = (photo.likes || 0) + 1;
  savePhotos(Array.from(map.values()));
  await cloudUpsertPhoto(photo);
  return photo;
}

export async function deleteStoredFile(id: string): Promise<boolean> {
  const map = await loadPhotosAsync();
  const photo = map.get(id);
  if (!photo) return false;

  await deleteFromStorage(photo.url);
  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.url) {
    await deleteFromStorage(photo.thumbnailUrl);
  }
  map.delete(id);
  savePhotos(Array.from(map.values()));
  await cloudDeletePhoto(id);
  return true;
}

export async function deletePhotosForEvent(eventId: string): Promise<number> {
  const map = await loadPhotosAsync();
  const cleanId = eventId.trim().toLowerCase();
  let deletedCount = 0;

  for (const [id, photo] of Array.from(map.entries())) {
    if (photo.eventId?.toLowerCase() === cleanId) {
      await deleteFromStorage(photo.url);
      if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.url) {
        await deleteFromStorage(photo.thumbnailUrl);
      }
      map.delete(id);
      await cloudDeletePhoto(id);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    savePhotos(Array.from(map.values()));
  }
  return deletedCount;
}
