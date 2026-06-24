import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import type { YardEvent } from "@/lib/types";
import { attendeeToYardTix, type AttendeeRow, type YardTix } from "@/lib/yardtix";
import { fetchTicketsForHolder, type TicketRow } from "@/lib/orders";

function ticketRowToYardTix(row: TicketRow, event?: YardEvent): YardTix {
  return {
    id: row.id,
    eventId: row.event_id ?? "",
    userId: row.holder_id ?? "",
    kind: "ticket",
    ticketNumber: row.ticket_number ?? row.id,
    orderNumber: row.order_id ?? "",
    status: (row.status as YardTix["status"]) || "confirmed",
    qrToken: row.qr_token ?? row.id,
    createdAt: row.created_at,
    event,
  };
}

// Every RSVP / paid ticket the signed-in user holds, joined to its event.
//
//   - RSVPs come from event_attendees (source='rsvp') — always available.
//   - Paid tickets come from yardtix_tickets (holder_id = me) — minted by the
//     Stripe webhook. That table ships in a later migration, so a missing table
//     degrades to "no paid tickets yet" while RSVPs keep working.
export function useMyYardTix() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ["my-yardtix", userId],
    enabled: !!userId,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<YardTix[]> => {
      // RSVPs (and any legacy 'ticket' reservation rows) from event_attendees.
      const { data: rows, error } = await supabase
        .from("event_attendees")
        .select("id, event_id, user_id, source, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const attendees = ((rows ?? []) as AttendeeRow[]).filter((a) => a.source === "rsvp");

      // Paid, minted tickets (graceful when the table is absent).
      const paidTickets = await fetchTicketsForHolder(userId as string);

      const eventIds = Array.from(
        new Set([
          ...attendees.map((a) => a.event_id),
          ...paidTickets.map((t) => t.event_id ?? ""),
        ].filter(Boolean)),
      );

      const byId = new Map<string, YardEvent>();
      if (eventIds.length > 0) {
        const { data: events } = await supabase.from("events").select("*").in("id", eventIds);
        (events ?? []).forEach((e) => byId.set((e as YardEvent).id, e as YardEvent));
      }

      const rsvpTix = attendees.map((a) => attendeeToYardTix(a, byId.get(a.event_id)));
      const paidTix = paidTickets.map((t) =>
        ticketRowToYardTix(t, t.event_id ? byId.get(t.event_id) : undefined),
      );

      // Paid tickets first (most relevant), then RSVPs.
      return [...paidTix, ...rsvpTix];
    },
  });
}

// Cancel a single YardTix (removes the underlying attendee row — RSVPs only;
// paid tickets are managed via refunds, not deletion).
export function useCancelYardTix() {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("id", rowId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-yardtix", userId] });
    },
  });
}
