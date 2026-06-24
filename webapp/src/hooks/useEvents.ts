import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { YardEvent } from "@/lib/types";

// Only visible, live events. RLS already scopes reads to authenticated users.
export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async (): Promise<YardEvent[]> => {
      // Public listings show published events only (drafts/cancelled stay private).
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .or("is_hidden.is.null,is_hidden.eq.false")
        .in("status", ["published", "sales_ended", "completed"])
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as YardEvent[];
    },
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ["event", id],
    enabled: !!id,
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
