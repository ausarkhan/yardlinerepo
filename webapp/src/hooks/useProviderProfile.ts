import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import type { ServiceProvider, Service } from "@/lib/types";

// The signed-in user's own provider profile (or null if they aren't a provider yet).
export function useMyProviderProfile() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-provider", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ServiceProvider | null> => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as ServiceProvider) ?? null;
    },
  });
}

// Every service the signed-in provider owns — including inactive ones, for management.
export function useMyServices() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-services", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("provider_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });
}
