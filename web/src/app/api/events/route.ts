import { NextResponse } from "next/server";
import { createEvent, getEvents } from "@/lib/events";

export async function GET() {
  try {
    const events = getEvents();
    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, date, location, coverUrl, description, code } = body;
    if (!name || !date || !location) {
      return NextResponse.json({ error: "Missing required fields (name, date, location)" }, { status: 400 });
    }
    const event = createEvent({
      name,
      date,
      location,
      coverUrl: coverUrl || "",
      description: description || "",
      code: code || undefined,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Invalid request" }, { status: 400 });
  }
}
