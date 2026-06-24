import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Review } from "@/lib/types";

export function useReviews(targetId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", targetId],
    enabled: !!targetId,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("target_id", targetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
}
