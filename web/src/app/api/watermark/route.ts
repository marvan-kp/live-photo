import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getWatermarkConfigAsync, saveWatermarkConfigAsync, WatermarkConfig } from "@/lib/watermark";
import { getUploadsDir, isVercelEnv } from "@/lib/paths";
import { uploadToStorage } from "@/lib/cloudStorage";
import { isUserAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const config = await getWatermarkConfigAsync();
    return NextResponse.json(
      { success: true, config },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = (await isUserAdmin()) ||
      req.headers.get("x-admin-key") === "marvan2026" ||
      req.headers.get("x-admin-password") === "marvan2026";

    // Also check multipart form admin key
    let formAdminKey = "";

    const contentType = req.headers.get("content-type") || "";
    let updates: Partial<WatermarkConfig> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      formAdminKey = (formData.get("adminKey") as string) || "";

      if (!isAdmin && formAdminKey !== "marvan2026" && formAdminKey !== "admin") {
        return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
      }

      const enabledStr = formData.get("enabled") as string;
      if (enabledStr !== null) {
        updates.enabled = enabledStr === "true" || enabledStr === "1";
      }

      const position = formData.get("position") as WatermarkConfig["position"];
      if (position) {
        updates.position = position;
      }

      const scaleStr = formData.get("scale") as string;
      if (scaleStr) {
        const num = parseFloat(scaleStr);
        if (!isNaN(num) && num > 0.05 && num < 0.6) updates.scale = num;
      }

      const opacityStr = formData.get("opacity") as string;
      if (opacityStr) {
        const num = parseFloat(opacityStr);
        if (!isNaN(num) && num >= 0.1 && num <= 1.0) updates.opacity = num;
      }

      // Handle custom logo file upload (Cloud-safe on Vercel read-only FS)
      const logoFile = formData.get("logo") as File | null;
      if (logoFile && logoFile.size > 0) {
        const arrayBuf = await logoFile.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const ext = path.extname(logoFile.name) || ".png";
        const savedLogoName = `custom_watermark_${Date.now()}${ext}`;

        // Save into static public dir only when local writable
        if (!isVercelEnv()) {
          try {
            const publicPath = path.join(process.cwd(), "public", savedLogoName);
            fs.writeFileSync(/*turbopackIgnore: true*/ publicPath, buf);
          } catch (_) {}
        }

        // Also persist in dynamic uploads dir and active Cloud Storage
        try {
          const uploadsPath = path.join(getUploadsDir(), savedLogoName);
          fs.writeFileSync(/*turbopackIgnore: true*/ uploadsPath, buf);
        } catch (_) {}

        const uploaded = await uploadToStorage(buf, savedLogoName, logoFile.type || "image/png");
        updates.logoPath = uploaded.url.startsWith("http")
          ? uploaded.url
          : isVercelEnv()
          ? `/api/uploads/${savedLogoName}`
          : `/${savedLogoName}`;
      }
    } else {
      if (!isAdmin) {
        return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
      }
      const body = await req.json();
      updates = body;
    }

    const updated = await saveWatermarkConfigAsync(updates);
    return NextResponse.json({
      success: true,
      message: "Watermark configuration updated successfully",
      config: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
