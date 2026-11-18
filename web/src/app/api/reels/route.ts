import { NextResponse } from "next/server";
import { getEventByIdAsync, getEventsAsync } from "@/lib/events";
import { listStoredFilesAsync } from "@/lib/storage";
import { getWatermarkConfigAsync } from "@/lib/watermark";
import { loadPhotosAsync, savePhotosAsync } from "@/lib/storage";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;
    const sortMode = searchParams.get("sort") || "highlights"; // highlights | newest | all
    const includeCulled = searchParams.get("includeCulled") === "true";

    const [events, watermarkConfig] = await Promise.all([
      getEventsAsync(),
      getWatermarkConfigAsync(),
    ]);

    const targetEventId = eventId || events[0]?.id;
    const event = targetEventId ? await getEventByIdAsync(targetEventId) : null;
    let photos = await listStoredFilesAsync(targetEventId);

    if (!includeCulled) {
      const approved = photos.filter((p) => !p.isCulled);
      if (approved.length > 0) {
        photos = approved;
      }
    }

    const enriched = photos.map((p) => {
      const qScore = p.qualityScore ?? 85;
      const likesBonus = Math.min(25, (p.likes || 0) * 5);
      const approvedBonus = p.cullStatus === "approved" ? 6 : 0;
      const highlightScore = Math.min(99, Math.round(qScore * 0.72 + likesBonus + approvedBonus));
      return {
        ...p,
        highlightScore,
        proxyUrl: `/api/reels/image?id=${encodeURIComponent(p.id)}&w=1400`,
      };
    });

    if (sortMode === "newest") {
      enriched.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortMode === "highlights") {
      enriched.sort(
        (a, b) =>
          b.highlightScore - a.highlightScore ||
          (b.likes || 0) - (a.likes || 0) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return NextResponse.json(
      {
        success: true,
        event,
        events,
        photos: enriched,
        watermarkLogoUrl: "/api/reels/image?asset=watermark",
        watermarkEnabled: watermarkConfig.enabled,
      },
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
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;
    const action = searchParams.get("action") || "create-reel";

    const body = await req.json();

    switch (action) {
      case "create-reel": {
        const { photoId, title, description, duration, effect, watermarked } = body;

        if (!photoId) {
          return NextResponse.json({ success: false, error: "Photo ID is required" }, { status: 400 });
        }

        // Get the photo from storage
        const allPhotos = await loadPhotosAsync();
        const photo = allPhotos.get(photoId);

        if (!photo) {
          return NextResponse.json({ success: false, error: "Photo not found" }, { status: 404 });
        }

        // Create reel entry
        const reelId = `reel_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const reel = {
          ...photo,
          id: reelId,
          photoId,
          title: title || `Reel ${photoId.substring(0, 6)}`,
          description: description || "",
          createdAt: new Date().toISOString(),
          duration: duration || 30,
          effect: effect || "none",
          watermarked: watermarked !== false,
          eventId: eventId || photo.eventId,
          views: 0,
          likes: photo.likes || 0,
        };

        // Add to photos with reel metadata
        const photosMap = await loadPhotosAsync();
        photosMap.set(photoId, {
          ...photo,
          reelId,
          reelTitle: reel.title,
          reelDescription: reel.description,
          reelCreatedAt: reel.createdAt,
          reelEffect: reel.effect,
          reelWatermarked: reel.watermarked,
        });
        await savePhotosAsync(Array.from(photosMap.values()));

        return NextResponse.json({
          success: true,
          reel,
          message: "Reel created successfully",
        });
      }

      case "update-reel": {
        const { reelId, title, description, effect } = body;

        if (!reelId) {
          return NextResponse.json({ success: false, error: "Reel ID is required" }, { status: 400 });
        }

        const photosMap = await loadPhotosAsync();
        let updated = false;

        for (const [id, photo] of photosMap.entries()) {
          if (photo.reelId === reelId) {
            photosMap.set(id, {
              ...photo,
              reelTitle: title || photo.reelTitle,
              reelDescription: description || photo.reelDescription,
              reelEffect: effect || photo.reelEffect,
            });
            updated = true;
          }
        }

        if (!updated) {
          return NextResponse.json({ success: false, error: "Reel not found" }, { status: 404 });
        }

        await savePhotosAsync(Array.from(photosMap.values()));

        return NextResponse.json({
          success: true,
          message: "Reel updated successfully",
        });
      }

      case "delete-reel": {
        const { reelId } = body;

        if (!reelId) {
          return NextResponse.json({ success: false, error: "Reel ID is required" }, { status: 400 });
        }

        const photosMap = await loadPhotosAsync();
        let deleted = false;

        for (const [id, photo] of photosMap.entries()) {
          if (photo.reelId === reelId) {
            delete photo.reelId;
            delete photo.reelTitle;
            delete photo.reelDescription;
            delete photo.reelCreatedAt;
            delete photo.reelEffect;
            delete photo.reelWatermarked;
            photosMap.set(id, photo);
            deleted = true;
          }
        }

        if (!deleted) {
          return NextResponse.json({ success: false, error: "Reel not found" }, { status: 404 });
        }

        await savePhotosAsync(Array.from(photosMap.values()));

        return NextResponse.json({
          success: true,
          message: "Reel deleted successfully",
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

