import { NextResponse } from "next/server";
import { listStoredFiles } from "@/lib/storage";
import { loadEvents } from "@/lib/events";
import { getDataFilePath } from "@/lib/paths";
import fs from "fs";
import path from "path";

const GUESTS_FILE = getDataFilePath("guests.json");

interface StoredGuestRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  eventId?: string;
  role?: string;
  status?: string;
  createdAt: string;
}

function loadManualGuests(): StoredGuestRecord[] {
  try {
    if (fs.existsSync(GUESTS_FILE)) {
      const data = fs.readFileSync(GUESTS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Could not read guests.json:", e);
  }
  return [];
}

function saveManualGuests(guests: StoredGuestRecord[]) {
  try {
    const dir = path.dirname(GUESTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(GUESTS_FILE, JSON.stringify(guests, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save guests.json:", e);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filterEventId = searchParams.get("eventId") || undefined;
    const query = searchParams.get("q")?.toLowerCase().trim() || "";

    const allEvents = loadEvents();
    const eventMap = new Map<string, { id: string; name: string; code: string }>();
    allEvents.forEach((e) => {
      eventMap.set(e.id.toLowerCase(), { id: e.id, name: e.name, code: e.code });
      if (e.code) {
        eventMap.set(e.code.toLowerCase(), { id: e.id, name: e.name, code: e.code });
      }
    });

    // 1. Gather all photos
    const allPhotos = listStoredFiles();
    const manualGuests = loadManualGuests();

    // 2. Aggregate guests by name
    const guestMap = new Map<
      string,
      {
        id: string;
        name: string;
        email?: string;
        role: string;
        events: Map<string, { id: string; name: string; code: string }>;
        photos: any[];
        photosCount: number;
        totalLikes: number;
        firstSeen: string;
        lastActive: string;
      }
    >();

    // Seed from manual guests
    for (const mg of manualGuests) {
      const key = mg.name.trim().toLowerCase();
      if (!guestMap.has(key)) {
        const ev = mg.eventId ? eventMap.get(mg.eventId.toLowerCase()) : null;
        const evMap = new Map<string, { id: string; name: string; code: string }>();
        if (ev) evMap.set(ev.id, ev);

        guestMap.set(key, {
          id: mg.id || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: mg.name.trim(),
          email: mg.email || "",
          role: mg.role || "Invited Guest",
          events: evMap,
          photos: [],
          photosCount: 0,
          totalLikes: 0,
          firstSeen: mg.createdAt || new Date().toISOString(),
          lastActive: mg.createdAt || new Date().toISOString(),
        });
      }
    }

    // Aggregate from uploaded photos
    for (const photo of allPhotos) {
      const guestName = (photo.guestName || "Guest").trim();
      const key = guestName.toLowerCase();
      const photoEvent = photo.eventId ? eventMap.get(photo.eventId.toLowerCase()) : null;

      let guest = guestMap.get(key);
      if (!guest) {
        guest = {
          id: `guest_${key.replace(/[^a-z0-9]/g, "_")}`,
          name: guestName,
          email: "",
          role: guestName.toLowerCase().includes("marvan") ? "Host / Organizer" : "Live Contributor",
          events: new Map(),
          photos: [],
          photosCount: 0,
          totalLikes: 0,
          firstSeen: photo.createdAt,
          lastActive: photo.createdAt,
        };
        guestMap.set(key, guest);
      }

      if (photoEvent) {
        guest.events.set(photoEvent.id, photoEvent);
      } else if (photo.eventId) {
        guest.events.set(photo.eventId, { id: photo.eventId, name: photo.eventId, code: photo.eventId });
      }

      guest.photos.push({
        id: photo.id,
        url: photo.url,
        name: photo.name,
        caption: photo.caption,
        likes: photo.likes || 0,
        createdAt: photo.createdAt,
        eventId: photo.eventId,
      });

      guest.photosCount++;
      guest.totalLikes += photo.likes || 0;

      if (new Date(photo.createdAt).getTime() > new Date(guest.lastActive).getTime()) {
        guest.lastActive = photo.createdAt;
      }
      if (new Date(photo.createdAt).getTime() < new Date(guest.firstSeen).getTime()) {
        guest.firstSeen = photo.createdAt;
      }
    }

    // Convert map to array
    let guests = Array.from(guestMap.values()).map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email,
      role: g.role,
      events: Array.from(g.events.values()),
      photosCount: g.photosCount,
      totalLikes: g.totalLikes,
      firstSeen: g.firstSeen,
      lastActive: g.lastActive,
      photos: g.photos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }));

    // Filter by eventId if provided
    if (filterEventId) {
      const cleanEvent = filterEventId.trim().toLowerCase();
      guests = guests.filter((g) =>
        g.events.some((e) => e.id.toLowerCase() === cleanEvent || e.code.toLowerCase() === cleanEvent)
      );
    }

    // Filter by search query if provided
    if (query) {
      guests = guests.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.email?.toLowerCase().includes(query) ||
          g.events.some((e) => e.name.toLowerCase().includes(query) || e.code.toLowerCase().includes(query))
      );
    }

    // Sort by photos count desc, then likes desc
    guests.sort((a, b) => b.photosCount - a.photosCount || b.totalLikes - a.totalLikes);

    // Summary calculation
    const totalGuests = guests.length;
    const totalPhotos = guests.reduce((sum, g) => sum + g.photosCount, 0);
    const totalLikes = guests.reduce((sum, g) => sum + g.totalLikes, 0);
    const topContributor =
      guests.length > 0 && guests[0].photosCount > 0
        ? { name: guests[0].name, photosCount: guests[0].photosCount, totalLikes: guests[0].totalLikes }
        : null;

    return NextResponse.json({
      success: true,
      guests,
      summary: {
        totalGuests,
        totalPhotos,
        totalLikes,
        topContributor,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, eventId, role } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
    }

    const manualGuests = loadManualGuests();
    const newGuest: StoredGuestRecord = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      eventId: eventId || "marvan-live-2026",
      role: role || "VIP Guest",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    manualGuests.unshift(newGuest);
    saveManualGuests(manualGuests);

    return NextResponse.json({
      success: true,
      message: "Guest registered successfully",
      guest: newGuest,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Guest ID is required" }, { status: 400 });
    }

    const manualGuests = loadManualGuests();
    const filtered = manualGuests.filter((g) => g.id !== id);
    saveManualGuests(filtered);

    return NextResponse.json({ success: true, message: "Guest removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

