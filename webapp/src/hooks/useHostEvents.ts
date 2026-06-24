import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import type { YardEvent } from "@/lib/types";

export interface EventStat {
  rsvps: number;
  tickets: number;
  total: number;
}

export interface HostDashboardData {
  events: YardEvent[];
  stats: Record<string, EventStat>;
}

// All events owned by the signed-in user (any status) + live attendee counts.
export function useHostEvents() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ["host-events", userId],
    enabled: !!userId,
    queryFn: async (): Promise<HostDashboardData> => {
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .eq("host_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = (events ?? []) as YardEvent[];
      const stats: Record<string, EventStat> = {};
      list.forEach((e) => (stats[e.id] = { rsvps: 0, tickets: 0, total: 0 }));

      if (list.length > 0) {
        const ids = list.map((e) => e.id);
        const { data: attendees } = await supabase
          .from("event_attendees")
          .select("event_id, source")
          .in("event_id", ids);
        (attendees ?? []).forEach((a) => {
          const s = stats[a.event_id];
          if (!s) return;
          if (a.source === "ticket") s.tickets += 1;
          else s.rsvps += 1;
          s.total += 1;
        });
      }

      return { events: list, stats };
    },
  });
}

// A single event the host owns (for edit / attendee pages).
export function useHostEvent(id: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["host-event", id, userId],
    enabled: !!id && !!userId,
    queryFn: async (): Promise<YardEvent | null> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as YardEvent) ?? null;
    },
  });
}
