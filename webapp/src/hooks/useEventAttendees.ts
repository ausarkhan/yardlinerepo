import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { attendeeToYardTix, type AttendeeRow, type YardTix } from "@/lib/yardtix";
import { fetchOrdersForEvent, fetchTicketsForEvent } from "@/lib/orders";

export interface AttendeeEntry extends YardTix {
  name: string;
  email: string;
  avatar: string | null;
  handle: string | null;
}

// Attendee roster for a host's event: attendee rows joined to profiles.
export function useEventAttendees(eventId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["event-attendees", eventId],
    enabled: !!eventId && enabled,
    queryFn: async (): Promise<AttendeeEntry[]> => {
      const currentEventId = eventId as string;
      const { data: rows, error } = await supabase
        .from("event_attendees")
        .select("id, event_id, user_id, source, created_at")
        .eq("event_id", currentEventId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const attendees = (rows ?? []) as AttendeeRow[];
      const [tickets, orders] = await Promise.all([
        fetchTicketsForEvent(currentEventId),
        fetchOrdersForEvent(currentEventId),
      ]);
      if (attendees.length === 0 && tickets.length === 0) return [];

      const ordersById = new Map(orders.map((order) => [order.id, order]));
      const userIds = Array.from(
        new Set([
          ...attendees.map((a) => a.user_id),
          ...tickets.map((t) => t.holder_id ?? "").filter(Boolean),
          ...orders.map((o) => o.buyer_id ?? "").filter(Boolean),
        ]),
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, avatar, handle")
        .in("id", userIds);

      const byId = new Map<string, Partial<Profile>>();
      (profiles ?? []).forEach((p) => byId.set((p as Profile).id, p as Profile));

      const attendeeEntries = attendees.map((a) => {
        const p = byId.get(a.user_id);
        return {
          ...attendeeToYardTix(a),
          name: p?.name || "Member",
          email: p?.email || "—",
          avatar: p?.avatar ?? null,
          handle: p?.handle ?? null,
        };
      });

      const ticketEntries = tickets.map((t) => {
        const order = t.order_id ? ordersById.get(t.order_id) : undefined;
        const holderId = t.holder_id ?? order?.buyer_id ?? "";
        const p = byId.get(holderId);
        return {
          id: t.id,
          eventId: t.event_id ?? currentEventId,
          userId: holderId,
          kind: "ticket" as const,
          ticketNumber: t.ticket_number ?? t.id,
          orderNumber: order?.order_number ?? t.order_id ?? "",
          status:
            ((t.status || (order?.payment_status === "paid" ? "confirmed" : null)) as YardTix["status"]) ||
            "confirmed",
          qrToken: t.qr_token ?? t.id,
          createdAt: t.created_at ?? order?.created_at ?? null,
          name: p?.name || "Member",
          email: p?.email || "—",
          avatar: p?.avatar ?? null,
          handle: p?.handle ?? null,
        };
      });

      return [...ticketEntries, ...attendeeEntries].sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
      });
    },
  });
}
