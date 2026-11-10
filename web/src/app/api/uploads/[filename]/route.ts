import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUploadsDir } from "@/lib/paths";
import { fetchFromCloudStorage } from "@/lib/cloudStorage";

export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const safeName = path.basename(filename);
    
    // Check dynamic uploads dir (/tmp/uploads on Vercel) first
    let filePath = path.join(getUploadsDir(), safeName);
    if (!fs.existsSync(filePath)) {
      // Fallback to static public uploads dir
      filePath = path.join(process.cwd(), "public", "uploads", safeName);
    }

    // If requested thumbnail doesn't exist locally, try Cloud Storage for the thumbnail first
    if (!fs.existsSync(filePath)) {
      const cloudFile = await fetchFromCloudStorage(safeName);
      if (cloudFile) {
        return new Response(new Uint8Array(cloudFile.buffer), {
          headers: {
            "Content-Type": cloudFile.contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // If requested thumbnail doesn't exist, gracefully fall back to original
    if (!fs.existsSync(filePath) && safeName.startsWith("thumb_")) {
      const origName = safeName.replace(/^thumb_/, "");
      filePath = path.join(getUploadsDir(), origName);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), "public", "uploads", origName);
      }
      if (!fs.existsSync(filePath)) {
        const cloudOrig = await fetchFromCloudStorage(origName);
        if (cloudOrig) {
          return new Response(new Uint8Array(cloudOrig.buffer), {
            headers: {
              "Content-Type": cloudOrig.contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    let contentType = "image/jpeg";
    if (ext === ".png") contentType = "image/png";
    if (ext === ".webp") contentType = "image/webp";
    if (ext === ".gif") contentType = "image/gif";
    if (ext === ".svg") contentType = "image/svg+xml";

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

