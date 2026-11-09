import { NextResponse } from "next/server";
import { uploadFileToCloud, listStoredFiles, likePhoto, deleteStoredFile } from "@/lib/storage";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;
    const files = listStoredFiles(eventId);
    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const thumbnails = formData.getAll("thumbnails") as File[];
    const eventId = (formData.get("eventId") as string) || undefined;
    const guestName = (formData.get("guestName") as string) || undefined;
    const caption = (formData.get("caption") as string) || undefined;

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const uploadedResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let thumbBuffer: Buffer | undefined;
      const thumbFile = thumbnails[i];
      if (thumbFile) {
        thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());
      }

      const savedFile = await uploadFileToCloud(
        buffer,
        file.name,
        file.type || "image/jpeg",
        eventId,
        guestName,
        caption,
        thumbBuffer
      );
      uploadedResults.push(savedFile);
    }

    return NextResponse.json({
      message: "Successfully uploaded photos",
      count: uploadedResults.length,
      files: uploadedResults,
      status: "success"
    });
  } catch (error: any) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { action, photoId } = body;
    if (action === "like" && photoId) {
      const updated = likePhoto(photoId);
      if (!updated) {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, photo: updated });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get("photoId") || searchParams.get("id");
    if (!photoId) {
      return NextResponse.json({ error: "photoId is required" }, { status: 400 });
    }
    const success = await deleteStoredFile(photoId);
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
