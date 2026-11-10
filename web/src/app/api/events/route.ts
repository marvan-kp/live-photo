import { NextResponse } from "next/server";
import { createEventAsync, getEventsAsync } from "@/lib/events";

export async function GET() {
  try {
    const events = await getEventsAsync();
    return NextResponse.json(
      { events },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, date, location, coverUrl, description, code, pin } = body;
    if (!name || !date || !location) {
      return NextResponse.json({ error: "Missing required fields (name, date, location)" }, { status: 400 });
    }
    const event = await createEventAsync({
      name,
      date,
      location,
      coverUrl: coverUrl || "",
      description: description || "",
      code: code || undefined,
      pin: pin ? String(pin).trim() : undefined,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Invalid request" }, { status: 400 });
  }
}
