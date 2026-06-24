import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import type { YardEvent } from "@/lib/types";
import type { AttendeeRow } from "@/lib/yardtix";

export interface EventCapacity {
  rsvps: number;
  tickets: number;
  total: number;
}

// Live attendee counts for an event (computed from event_attendees).
export function useEventCapacity(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-capacity", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<EventCapacity> => {
      const { data, error } = await supabase
        .from("event_attendees")
        .select("source")
        .eq("event_id", eventId);
      if (error) throw error;
      const rows = data ?? [];
      const tickets = rows.filter((r) => r.source === "ticket").length;
      const rsvps = rows.length - tickets;
      return { rsvps, tickets, total: rows.length };
    },
  });
}

// The current user's own attendance rows for an event.
export function useMyAttendance(eventId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["event-attendance", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async (): Promise<AttendeeRow[]> => {
      const { data, error } = await supabase
        .from("event_attendees")
        .select("id, event_id, user_id, source, created_at")
        .eq("event_id", eventId)
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as AttendeeRow[];
    },
  });
}

export function useTicketingActions(event: YardEvent) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["event-capacity", event.id] });
    qc.invalidateQueries({ queryKey: ["event-attendance", event.id, userId] });
    qc.invalidateQueries({ queryKey: ["my-yardtix", userId] });
  };

  async function liveTotal(): Promise<number> {
    const { count } = await supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    return count ?? 0;
  }

  const rsvp = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please sign in to RSVP.");
      // Prevent duplicate RSVP.
      const { count: existing } = await supabase
        .from("event_attendees")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("user_id", userId)
        .eq("source", "rsvp");
      if ((existing ?? 0) > 0) throw new Error("You’ve already RSVP’d to this event.");
      // Respect capacity.
      if (event.max_tickets != null && (await liveTotal()) >= event.max_tickets) {
        throw new Error("This event is at capacity.");
      }
      const { error } = await supabase
        .from("event_attendees")
        .insert({ event_id: event.id, user_id: userId, source: "rsvp" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const cancelRsvp = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", userId)
        .eq("source", "rsvp");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Reserve a paid-ticket spot (no payment yet). The database allows ONE
  // attendee record per (event, user), so this is a single reservation hold;
  // the selected quantity/tier is the cart that finalizes at Phase-4 checkout.
  const reserve = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Please sign in to reserve tickets.");

      // Already holding a spot?
      const { data: existing } = await supabase
        .from("event_attendees")
        .select("id, source")
        .eq("event_id", event.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) throw new Error("You already have a reservation for this event.");

      // Overall capacity (ticket holders).
      if (event.max_tickets != null) {
        const total = await liveTotal();
        if (total >= event.max_tickets) throw new Error("This event is sold out.");
      }

      const { error } = await supabase
        .from("event_attendees")
        .insert({ event_id: event.id, user_id: userId, source: "ticket" });
      if (error) {
        if (error.code === "23505") throw new Error("You already have a reservation for this event.");
        throw error;
      }
    },
    onSuccess: invalidate,
  });

  // Release a paid reservation.
  const releaseTicket = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", userId)
        .eq("source", "ticket");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { rsvp, cancelRsvp, reserve, releaseTicket };
}
