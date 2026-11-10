import { NextResponse } from "next/server";
import { getEventByIdAsync, updateEventAsync, deleteEventAsync } from "@/lib/events";
import { deletePhotosForEvent } from "@/lib/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const event = await getEventByIdAsync(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json(
    { event },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    }
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();
  const event = await updateEventAsync(id, body);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ event });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const deletedPhotosCount = await deletePhotosForEvent(id);
  const success = await deleteEventAsync(id);
  if (!success) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({
    message: "Event and associated cloud/local photos deleted successfully",
    deletedPhotosCount,
  });
}