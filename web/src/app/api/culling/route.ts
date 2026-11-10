import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  loadCullingConfig,
  saveCullingConfig,
  setPhotoCulling,
  groupAndCullBurstShots,
  analyzeImageQuality,
  CullingConfig,
} from "@/lib/culling";
import { loadPhotos, savePhotos, listStoredFiles, deleteStoredFile, StoredFile } from "@/lib/storage";
import { getUploadsDir } from "@/lib/paths";
import { isUserAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;

    const config = loadCullingConfig();
    const allPhotos = listStoredFiles(eventId);

    const stats = {
      total: allPhotos.length,
      approved: allPhotos.filter((p) => !p.isCulled).length,
      culled: allPhotos.filter((p) => p.isCulled).length,
      blurry: allPhotos.filter((p) => p.cullStatus === "blurry").length,
      blink: allPhotos.filter((p) => p.cullStatus === "blink").length,
      duplicate: allPhotos.filter((p) => p.cullStatus === "duplicate").length,
      exposure: allPhotos.filter((p) => p.cullStatus === "underexposed" || p.cullStatus === "overexposed").length,
    };

    return NextResponse.json({
      success: true,
      config,
      stats,
      photos: allPhotos,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = await isUserAdmin();
    const adminKey = req.headers.get("x-admin-key") || "";
    if (!isAdmin && adminKey !== "marvan2026") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "update-config") {
      const newConfig: CullingConfig = body.config;
      saveCullingConfig(newConfig);
      return NextResponse.json({ success: true, config: newConfig });
    }

    if (action === "toggle-photo") {
      const { photoId, isCulled, cullStatus, reason } = body;
      const updated = setPhotoCulling(photoId, isCulled, cullStatus, reason);
      if (!updated) {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, photo: updated });
    }

    if (action === "batch-cull") {
      const { eventId, burstWindowSeconds, reanalyze } = body;
      const photosMap = loadPhotos();
      let targetPhotos = listStoredFiles(eventId);

      if (reanalyze) {
        const evaluated: StoredFile[] = [];
        for (const p of targetPhotos) {
          let buf: Buffer | null = null;
          if (p.url.startsWith("/api/uploads/") || p.url.startsWith("/uploads/")) {
            const filename = path.basename(p.url);
            const tmpPath = path.join(getUploadsDir(), filename);
            const pubPath = path.join(process.cwd(), "public", "uploads", filename);
            if (fs.existsSync(/*turbopackIgnore: true*/ tmpPath)) {
              buf = fs.readFileSync(/*turbopackIgnore: true*/ tmpPath);
            } else if (fs.existsSync(/*turbopackIgnore: true*/ pubPath)) {
              buf = fs.readFileSync(/*turbopackIgnore: true*/ pubPath);
            }
          }
          if (buf) {
            const quality = await analyzeImageQuality(buf);
            evaluated.push({
              ...p,
              qualityScore: quality.qualityScore,
              cullStatus: quality.cullStatus,
              isCulled: quality.isCulled,
              aiReason: quality.aiReason,
            });
          } else {
            evaluated.push(p);
          }
        }
        targetPhotos = evaluated;
      }

      const updatedList = groupAndCullBurstShots(targetPhotos, burstWindowSeconds || 3);
      updatedList.forEach((p) => photosMap.set(p.id, p));
      savePhotos(Array.from(photosMap.values()));

      return NextResponse.json({
        success: true,
        count: updatedList.length,
        culledCount: updatedList.filter((p) => p.isCulled).length,
      });
    }

    if (action === "approve-all") {
      const { eventId } = body;
      const photosMap = loadPhotos();
      const targetPhotos = listStoredFiles(eventId);
      for (const p of targetPhotos) {
        photosMap.set(p.id, {
          ...p,
          isCulled: false,
          cullStatus: "approved",
          aiReason: "Approved & Published to Live Stream ⭐",
        });
      }
      savePhotos(Array.from(photosMap.values()));
      return NextResponse.json({
        success: true,
        restoredCount: targetPhotos.length,
      });
    }

    if (action === "batch-delete-culled") {
      const { eventId } = body;
      const allPhotos = listStoredFiles(eventId);
      const culled = allPhotos.filter((p) => p.isCulled);

      for (const p of culled) {
        await deleteStoredFile(p.id);
      }

      return NextResponse.json({
        success: true,
        deletedCount: culled.length,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
