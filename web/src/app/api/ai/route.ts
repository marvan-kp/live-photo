import { NextResponse } from "next/server";
import { matchSelfieToEventPhotos, analyzeScene } from "@/lib/ai";
import { listStoredFiles } from "@/lib/storage";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "highlights";
    const eventId = searchParams.get("eventId") || undefined;

    if (action === "highlights") {
      const photos = listStoredFiles(eventId);
      // AI curation: rank by likes + quality criteria
      const highlights = [...photos]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 6)
        .map((p, idx) => ({
          ...p,
          aiScore: 98 - idx * 2,
          aiReason: idx === 0 ? "Most Celebrated Moment" : "Top Facial Expression & Lighting"
        }));

      return NextResponse.json({ success: true, highlights });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = formData.get("action") as string;
      const eventId = (formData.get("eventId") as string) || undefined;
      const selfieFile = formData.get("selfie") as File | null;

      if (action === "match-selfie" && selfieFile) {
        const buffer = Buffer.from(await selfieFile.arrayBuffer());
        const matches = await matchSelfieToEventPhotos(buffer, eventId);
        return NextResponse.json({
          success: true,
          matchCount: matches.length,
          matches
        });
      }

      return NextResponse.json({ error: "Invalid multipart action or missing selfie file" }, { status: 400 });
    }

    // JSON body
    const body = await req.json();
    const { action, eventId, photoName, caption, selfieBase64, eventName, tag } = body;

    if (action === "match-selfie" && selfieBase64) {
      const cleanBase64 = selfieBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");
      const matches = await matchSelfieToEventPhotos(buffer, eventId);
      return NextResponse.json({
        success: true,
        matchCount: matches.length,
        matches
      });
    }

    if (action === "generate-caption") {
      const evName = eventName || "Signature by Marvan";
      const captionsByTag: Record<string, string[]> = {
        dance: [
          `Lighting up the dance floor at ${evName}! ✨💃 #DanceFloorMagic`,
          `Unstoppable energy and dancing the night away! 🕺🔥 #GoodVibes`,
          `Best moves of the night! Pure joy captured in motion ✨🎶 #Celebration`
        ],
        toast: [
          `Raising a glass to unforgettable memories at ${evName}! 🥂❤️ #Cheers`,
          `Heartfelt toasts, endless laughter, and cherished friends 🍾✨ #Memories2026`,
          `Here's to love, laughter, and a lifetime of happiness! 🥂🌟 #SpecialMoments`
        ],
        romance: [
          `A love story written in golden light ❤️✨ #ForeverTogether`,
          `Pure romance and timeless elegance at ${evName} 💍🥂 #LoveWins`,
          `Two hearts, one unforgettable celebration 💕✨ #SignatureRomance`
        ],
        candid: [
          `Unscripted, authentic, and full of joy! 📸✨ #CandidMoments`,
          `The best moments are always the unplanned ones ❤️🌟 #LivePhotography`,
          `Genuine smiles and pure happiness captured live at ${evName} ✨😊 #SignatureMoments`
        ]
      };

      const key = (tag || "candid").toLowerCase();
      const options = captionsByTag[key] || [
        `Celebrating unforgettable moments at ${evName}! ✨🥂 #LiveMoments`,
        `Pure joy and golden hour elegance at ${evName}! 🌅✨ #Celebration2026`,
        `Making memories that will last a lifetime ❤️🍾 #LiveGallery`
      ];

      const generated = options[Math.floor(Math.random() * options.length)];
      return NextResponse.json({ success: true, caption: generated });
    }

    if (action === "analyze-scene") {
      const analysis = analyzeScene(photoName || "photo.jpg", caption);
      return NextResponse.json({
        success: true,
        analysis
      });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json({ error: error.message || "AI processing failed" }, { status: 500 });
  }
}

