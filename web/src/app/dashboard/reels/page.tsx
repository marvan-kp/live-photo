"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReelStudio } from "@/components/reels/ReelStudio";
import { Loader2 } from "lucide-react";

function DashboardReelsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") || undefined;

  return <ReelStudio initialEventId={eventId} mode="studio" />;
}

export default function DashboardReelsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex justify-center text-accent">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <DashboardReelsContent />
    </Suspense>
  );
}

