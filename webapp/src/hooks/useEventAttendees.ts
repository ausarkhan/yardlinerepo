import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { attendeeToYardTix, type AttendeeRow, type YardTix } from "@/lib/yardtix";

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
      const { data: rows, error } = await supabase
        .from("event_attendees")
        .select("id, event_id, user_id, source, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const attendees = (rows ?? []) as AttendeeRow[];
      if (attendees.length === 0) return [];

      const userIds = Array.from(new Set(attendees.map((a) => a.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, avatar, handle")
        .in("id", userIds);

      const byId = new Map<string, Partial<Profile>>();
      (profiles ?? []).forEach((p) => byId.set((p as Profile).id, p as Profile));

      return attendees.map((a) => {
        const p = byId.get(a.user_id);
        return {
          ...attendeeToYardTix(a),
          name: p?.name || "Member",
          email: p?.email || "—",
          avatar: p?.avatar ?? null,
          handle: p?.handle ?? null,
        };
      });
    },
  });
}
