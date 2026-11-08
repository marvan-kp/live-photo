"use server";

import { NextResponse } from "next/server";
import { Event, getEventById, updateEvent, deleteEvent } from "@/lib/events";
import { deletePhotosForEvent } from "@/lib/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const event = getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ event });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();
  const event = updateEvent(id, body);
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
  const success = deleteEvent(id);
  if (!success) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({
    message: "Event and associated cloud/local photos deleted successfully",
    deletedPhotosCount,
  });
}