import fs from 'fs';
import path from 'path';
import { getDataFilePath } from './paths';

export interface Event {
  id: string;
  code: string;
  name: string;
  description?: string;
  date: string;
  location: string;
  coverUrl: string;
  photosCount: number;
  guestsCount: number;
  status: 'active' | 'upcoming' | 'archived';
  pin?: string;
  createdAt: string;
}

const DATA_FILE = getDataFilePath('events.json');

const INITIAL_EVENTS: Event[] = [
  {
    id: 'marvan-live-2026',
    code: 'MARVAN',
    name: 'Signature by Marvan — Live Gallery',
    description: 'Official live photography gallery. Scan QR or snap a selfie to find all your photos!',
    date: '2026-11-08',
    location: 'Signature Studios',
    coverUrl: '/logo.png',
    photosCount: 2,
    guestsCount: 15,
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

declare global {
  // eslint-disable-next-line no-var
  var __GLOBAL_EVENTS__: Event[] | undefined;
}

export function loadEvents(): Event[] {
  let diskEvents: Event[] = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        diskEvents = parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read events data file:', e);
  }

  const inMemory = globalThis.__GLOBAL_EVENTS__ || [];
  if (inMemory.length > 0) {
    const map = new Map<string, Event>();
    diskEvents.forEach(e => map.set(e.id, e));
    inMemory.forEach(e => {
      const existing = map.get(e.id);
      if (!existing) {
        map.set(e.id, e);
      } else {
        map.set(e.id, {
          ...existing,
          ...e,
          pin: e.pin || existing.pin,
          photosCount: Math.max(e.photosCount || 0, existing.photosCount || 0),
        });
      }
    });
    const merged = Array.from(map.values());
    globalThis.__GLOBAL_EVENTS__ = merged;
    return merged;
  }

  if (diskEvents.length > 0) {
    globalThis.__GLOBAL_EVENTS__ = diskEvents;
    return diskEvents;
  }

  saveEvents(INITIAL_EVENTS);
  return [...INITIAL_EVENTS];
}

export function saveEvents(events: Event[]) {
  globalThis.__GLOBAL_EVENTS__ = events;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not save events to disk:', e);
  }

  // Also try saving to process.cwd()/data for local development persistence
  try {
    const cwdFile = path.join(process.cwd(), "data", "events.json");
    if (cwdFile !== DATA_FILE) {
      const cwdDir = path.dirname(cwdFile);
      if (!fs.existsSync(cwdDir)) fs.mkdirSync(cwdDir, { recursive: true });
      fs.writeFileSync(cwdFile, JSON.stringify(events, null, 2), "utf-8");
    }
  } catch (_) {}
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const getEvents = (filter?: { status?: Event['status'] }): Event[] => {
  const events = loadEvents();
  if (filter?.status) {
    return events.filter(e => e.status === filter.status);
  }
  return events;
};

export const getEventById = (id: string): Event | null => {
  const events = loadEvents();
  const cleanId = id.trim().toLowerCase();
  return events.find(e => e.id.toLowerCase() === cleanId || e.code.toLowerCase() === cleanId) || null;
};

export const getEventByCode = (code: string): Event | null => {
  return getEventById(code);
};

export const createEvent = (
  eventData: Omit<Event, 'id' | 'code' | 'createdAt' | 'photosCount' | 'guestsCount' | 'status'> & { code?: string }
): Event => {
  const events = loadEvents();
  const slug = eventData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'event';
  
  const id = `${slug}-${Date.now().toString(36)}`;
  const code = eventData.code?.toUpperCase() || generateCode();

  const newEvent: Event = {
    id,
    code,
    createdAt: new Date().toISOString(),
    ...eventData,
    coverUrl: eventData.coverUrl || '/logo.png',
    photosCount: 0,
    guestsCount: 0,
    status: 'active'
  };

  events.unshift(newEvent);
  saveEvents(events);
  return newEvent;
};

export const updateEvent = (id: string, updates: Partial<Event>): Event | null => {
  const events = loadEvents();
  const index = events.findIndex(e => e.id === id);
  if (index === -1) return null;
  
  events[index] = { ...events[index], ...updates };
  saveEvents(events);
  return events[index];
};

export const deleteEvent = (id: string): boolean => {
  const events = loadEvents();
  const filtered = events.filter(e => e.id !== id && e.code !== id);
  if (filtered.length !== events.length) {
    saveEvents(filtered);
    return true;
  }
  return false;
};

export const incrementPhotoCount = (id: string): void => {
  const events = loadEvents();
  const event = events.find(e => e.id === id || e.code === id);
  if (event) {
    event.photosCount = (event.photosCount || 0) + 1;
    saveEvents(events);
  }
};
