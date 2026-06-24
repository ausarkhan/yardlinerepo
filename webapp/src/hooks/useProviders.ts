import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ServiceProvider, Service } from "@/lib/types";

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: async (): Promise<ServiceProvider[]> => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .or("is_hidden.is.null,is_hidden.eq.false")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServiceProvider[];
    },
  });
}

export function useProvider(id: string | undefined) {
  return useQuery({
    queryKey: ["provider", id],
    enabled: !!id,
    queryFn: async (): Promise<ServiceProvider | null> => {
      // Providers can be looked up by their row id or by the owning user_id.
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .or(`id.eq.${id},user_id.eq.${id}`)
        .maybeSingle();
      if (error) throw error;
      return (data as ServiceProvider) ?? null;
    },
  });
}

// services.provider_id references the provider's USER id (auth.users.id),
// NOT the service_providers row id — pass provider.user_id here.
export function useProviderServices(providerUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["provider-services", providerUserId],
    enabled: !!providerUserId,
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("provider_id", providerUserId)
        .or("active.is.null,active.eq.true")
        .order("price_cents", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });
}
