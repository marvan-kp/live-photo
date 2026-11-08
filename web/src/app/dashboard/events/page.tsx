"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Plus, Loader2 } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { EventModal, EventFormData } from "@/components/events/EventModal";
import { Event } from "@/lib/events";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data.events);
    } catch (error) {
      console.error("Failed to fetch events", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEvent = async (eventData: EventFormData) => {
    if (editingEvent) {
      // Update event
      try {
        const res = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        });
        if (res.ok) {
          fetchEvents();
          setIsModalOpen(false);
          setEditingEvent(null);
        } else {
          console.error("Failed to update event");
        }
      } catch (error) {
        console.error("Error updating event", error);
      }
    } else {
      // Create new event
      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        });
        if (res.ok) {
          fetchEvents();
          setIsModalOpen(false);
        } else {
          console.error("Failed to create event");
        }
      } catch (error) {
        console.error("Error creating event", error);
      }
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEvents();
      } else {
        console.error("Failed to delete event");
      }
    } catch (error) {
      console.error("Error deleting event", error);
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">My Events</h2>
        <GlassButton variant="primary" onClick={openCreateModal}>
          <Plus className="w-5 h-5 mr-2" />
          Create New Event
        </GlassButton>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-white/60" />
        </div>
      ) : events.length === 0 ? (
        <GlassCard className="text-center py-12">
          <h3 className="text-2xl font-semibold">No events yet</h3>
          <p className="text-white/60 mt-2">Start by creating your first event!</p>
          <GlassButton variant="secondary" onClick={openCreateModal} className="mt-6">
            <Plus className="w-4 h-4 mr-2" /> Create Event
          </GlassButton>
        </GlassCard>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence>
            {events.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <EventCard
                  event={event}
                  onEdit={openEditModal}
                  onDelete={handleDeleteEvent}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        initialData={editingEvent}
        title={editingEvent ? "Edit Event" : "Create New Event"}
      />
    </div>
  );
}