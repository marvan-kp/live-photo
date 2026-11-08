"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Calendar, MapPin, Image as ImageIcon, Edit, Trash2, QrCode, ExternalLink, Tv } from "lucide-react";
import { Event } from "@/lib/events";
import Link from "next/link";

interface EventCardProps {
  event: Event;
  onEdit?: (event: Event) => void;
  onDelete?: (event: Event) => void;
}

export const EventCard = ({ event, onEdit, onDelete }: EventCardProps) => {
  const statusColors = {
    active: "bg-green-500/20 text-green-400 border border-green-500/30",
    upcoming: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    archived: "bg-gray-500/20 text-gray-400 border border-gray-500/30"
  };

  const handleDelete = () => {
    if (confirm(`Delete "${event.name}"? This cannot be undone.`)) {
      onDelete?.(event);
    }
  };

  return (
    <GlassCard className="p-6 rounded-2xl border-white/20 hover:border-accent/40 transition-all group flex flex-col justify-between">
      <div className="flex flex-col gap-4">
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-black/50">
          {event.coverUrl ? (
            <img
              src={event.coverUrl}
              alt={event.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white/50">
              <ImageIcon className="w-12 h-12" />
            </div>
          )}
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <span className="px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg text-accent text-xs font-mono font-bold border border-white/10">
              {event.code}
            </span>
            <Link href="/dashboard/qr">
              <button
                title="View QR Code"
                className="p-2 bg-black/70 backdrop-blur rounded-lg text-white hover:bg-accent hover:text-black transition-colors border border-white/10"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white truncate pr-2">{event.name}</h3>
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${statusColors[event.status] || statusColors.active}`}>
              {event.status}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-white/60">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>{event.date}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span className="truncate">{event.location}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-accent pt-1">
            <span>{event.photosCount || 0} Photos</span>
            <span>•</span>
            <span>{event.guestsCount || 0} Guests</span>
          </div>
        </div>

        {/* Live Links */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
          <Link href={`/event/${event.id}`} target="_blank">
            <button className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Guest View
            </button>
          </Link>
          <Link href={`/event/${event.id}/live`} target="_blank">
            <button className="w-full py-2 px-3 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-accent/30">
              <Tv className="w-3.5 h-3.5" /> Projector
            </button>
          </Link>
        </div>

        <div className="flex gap-2 pt-1">
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5 border border-white/10"
            >
              <Edit className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-400 transition-colors flex items-center justify-center gap-1.5 border border-red-500/20"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
