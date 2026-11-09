import { NextResponse } from "next/server";
import { uploadFileToCloud, listStoredFiles, likePhoto, deleteStoredFile } from "@/lib/storage";
import { isUserAdmin } from "@/lib/auth";
import { applyWatermark } from "@/lib/watermark";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;
    const files = listStoredFiles(eventId);
    return NextResponse.json(
      {
        success: true,
        files,
        count: files.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // Enforce Admin-only upload: Guests and regular users are strictly forbidden from uploading
    const isAdmin = (await isUserAdmin()) ||
      req.headers.get("x-admin-key") === "marvan2026" ||
      req.headers.get("x-admin-password") === "marvan2026";
    const formAdminKey = (formData.get("adminKey") as string) || "";
    const authorized = isAdmin || formAdminKey === "marvan2026" || formAdminKey === "admin";

    if (!authorized) {
      return NextResponse.json(
        { error: "Upload restricted: Only Admin Photographers are permitted to upload photos. Guests and users cannot upload." },
        { status: 403 }
      );
    }

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

      // Apply custom studio logo watermark overlay
      const watermarkedBuffer = await applyWatermark(buffer);
      const watermarkedThumbBuffer = thumbBuffer ? await applyWatermark(thumbBuffer) : undefined;

      const savedFile = await uploadFileToCloud(
        watermarkedBuffer,
        file.name,
        file.type || "image/jpeg",
        eventId,
        guestName,
        caption,
        watermarkedThumbBuffer
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
    const isAdmin = (await isUserAdmin()) ||
      req.headers.get("x-admin-key") === "marvan2026" ||
      req.headers.get("x-admin-password") === "marvan2026";
    if (!isAdmin) {
      return NextResponse.json({ error: "Only admin can delete photos" }, { status: 403 });
    }

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
