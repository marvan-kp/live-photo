import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { listStoredFiles } from "@/lib/storage";
import { getUploadsDir } from "@/lib/paths";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = getEventById(id);
    const eventName = event ? event.name.replace(/[^a-zA-Z0-9_-]/g, "_") : id;
    const files = listStoredFiles(id);

    if (files.length === 0) {
      return NextResponse.json({ error: "No photos found for this event" }, { status: 404 });
    }

    const zip = new JSZip();
    const uploadsDir = getUploadsDir();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const indexStr = String(i + 1).padStart(3, "0");
      const guestClean = (file.guestName || "Guest").replace(/[^a-zA-Z0-9_-]/g, "_");
      const baseExt = path.extname(file.name) || ".jpg";
      const cleanFileName = `${indexStr}_${guestClean}_photo${baseExt}`;

      try {
        if (file.url.startsWith("http://") || file.url.startsWith("https://")) {
          const resp = await fetch(file.url);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            zip.file(cleanFileName, Buffer.from(arrayBuf));
          }
        } else {
          // Local upload file
          const localBasename = path.basename(file.url);
          const diskPath = path.join(uploadsDir, localBasename);
          if (fs.existsSync(diskPath)) {
            const buf = fs.readFileSync(diskPath);
            zip.file(cleanFileName, buf);
          }
        }
      } catch (err) {
        console.warn(`Could not add ${file.name} to zip:`, err);
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const safeFilename = `${eventName}_all_photos.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": String(zipBuffer.length)
      }
    });
  } catch (error: any) {
    console.error("ZIP download error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate ZIP archive" }, { status: 500 });
  }
}
