import { NextResponse } from "next/server";
import { getEventByIdAsync, getEventsAsync } from "@/lib/events";
import { listStoredFilesAsync } from "@/lib/storage";
import { getWatermarkConfigAsync } from "@/lib/watermark";

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

