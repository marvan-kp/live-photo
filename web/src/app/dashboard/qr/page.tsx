"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { QRCodeCard } from "@/components/ui/QRCodeCard";
import { QrCode, Sparkles, Printer, ExternalLink, Calendar, MapPin, Loader2 } from "lucide-react";
import Link from "next/link";
import { getPublicBaseUrl } from "@/lib/publicUrl";

interface Event {
  id: string;
  code: string;
  name: string;
  date: string;
  location: string;
  photosCount: number;
}

export default function QRManagerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        const evList: Event[] = data.events || [];
        setEvents(evList);
        if (evList.length > 0) {
          setSelectedEventId(evList[0].id);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];
  const hostUrl = getPublicBaseUrl();
  const eventUrl = selectedEvent ? `${hostUrl}/event/${selectedEvent.id}` : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white">QR Code Manager</h2>
          <p className="text-white/60 text-sm">
            Generate, customize, and print high-resolution QR signs for your events.
          </p>
        </div>

        {/* Event Selector Dropdown */}
        {events.length > 0 && (
          <div className="flex items-center gap-2 bg-graphite/80 border border-white/10 px-4 py-2 rounded-2xl">
            <span className="text-xs text-white/50 uppercase tracking-wider font-semibold">Event:</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-midnight text-white">
                  {ev.name} ({ev.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-accent">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : !selectedEvent ? (
        <GlassCard className="p-8 text-center space-y-4">
          <p className="text-white/60">No events found. Create an event first to generate its QR code.</p>
          <Link href="/dashboard/events">
            <GlassButton variant="primary">Create Event</GlassButton>
          </Link>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: QR Code Display Card */}
          <div className="lg:col-span-5">
            <QRCodeCard
              url={eventUrl}
              title={selectedEvent.name}
              subtitle="Scan with any camera phone to share photos live"
              code={selectedEvent.code}
            />
          </div>

          {/* Right Column: Print Card / Table Tent Preview & Details */}
          <div className="lg:col-span-7 space-y-6">
            <GlassCard className="p-6 md:p-8 space-y-6 border-white/20">
              <div className="space-y-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Table Tent / Sign Preview</span>
                <h3 className="text-2xl font-bold text-white">{selectedEvent.name}</h3>
                <p className="text-sm text-white/70">
                  Place this display at guest tables, entrances, or the bar. Guests simply open their camera app, scan, and instantly upload!
                </p>
              </div>

              {/* Event Details Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-graphite/50 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/50 uppercase">Date</p>
                  <p className="text-sm font-semibold text-white">{selectedEvent.date}</p>
                </div>
                <div className="bg-graphite/50 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/50 uppercase">Location</p>
                  <p className="text-sm font-semibold text-white truncate">{selectedEvent.location}</p>
                </div>
                <div className="bg-graphite/50 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/50 uppercase">Access Code</p>
                  <p className="text-sm font-mono font-bold text-accent">{selectedEvent.code}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link href={`/event/${selectedEvent.id}`} target="_blank">
                  <GlassButton variant="primary" className="text-xs px-4 py-2 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Open Guest Page
                  </GlassButton>
                </Link>
                <Link href={`/event/${selectedEvent.id}/live`} target="_blank">
                  <GlassButton variant="secondary" className="text-xs px-4 py-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" /> Launch Projector View
                  </GlassButton>
                </Link>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-full border border-white/20 text-white text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print Display Card
                </button>
              </div>
            </GlassCard>

            {/* How QR Sharing Works Callout */}
            <div className="p-6 rounded-3xl bg-graphite/40 border border-white/10 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> Why guests love this:
              </h4>
              <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
                <li>Zero app installation required for basic guest upload (works directly in mobile browser).</li>
                <li>Instant sync to the live projector stream in under 2 seconds.</li>
                <li>Guests can also download the Android APK for offline photo queues and high-res burst mode.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
