import { NextResponse } from "next/server";
import { getEventByIdAsync } from "@/lib/events";
import { listStoredFilesAsync } from "@/lib/storage";
import { fetchFromCloudStorage } from "@/lib/cloudStorage";
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
    const { searchParams } = new URL(req.url);
    const includeCulled = searchParams.get("includeCulled") === "true";

    const event = await getEventByIdAsync(id);
    const eventName = event ? event.name.replace(/[^a-zA-Z0-9_-]/g, "_") : id;
    const allFiles = await listStoredFilesAsync(id);
    const files = includeCulled ? allFiles : allFiles.filter((f) => !f.isCulled);

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
          // Local or /api/uploads proxy file
          const localBasename = path.basename(file.url);
          const diskPath = path.join(uploadsDir, localBasename);
          const publicPath = path.join(process.cwd(), "public", "uploads", localBasename);
          if (fs.existsSync(diskPath)) {
            zip.file(cleanFileName, fs.readFileSync(diskPath));
          } else if (fs.existsSync(publicPath)) {
            zip.file(cleanFileName, fs.readFileSync(publicPath));
          } else {
            const cloudFile = await fetchFromCloudStorage(localBasename);
            if (cloudFile) {
              zip.file(cleanFileName, cloudFile.buffer);
            }
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
