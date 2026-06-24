import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import type { Service, ServiceProvider, Profile } from "@/lib/types";
import {
  createBooking,
  setBookingStatus,
  type Booking,
  type CreateBookingInput,
  type BookingStatus,
} from "@/lib/services";
import { acceptBooking, declineBooking, cancelBooking } from "@/lib/checkout";

// A booking joined with the bits the UI needs to render it.
export interface BookingView extends Booking {
  service: Service | null;
  provider: ServiceProvider | null; // for the customer's view
  customer: Profile | null; // for the provider's view
}

async function fetchServices(ids: string[]): Promise<Record<string, Service>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return {};
  const { data } = await supabase.from("services").select("*").in("service_id", unique);
  const map: Record<string, Service> = {};
  (data ?? []).forEach((s) => (map[(s as Service).service_id] = s as Service));
  return map;
}

// Bookings the signed-in user has REQUESTED (as a customer).
export function useMyBookings() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-bookings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<BookingView[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Booking[];
      if (rows.length === 0) return [];

      const services = await fetchServices(rows.map((r) => r.service_id ?? "").filter(Boolean));
      const providerIds = Array.from(new Set(rows.map((r) => r.provider_id ?? "").filter(Boolean)));
      const { data: provs } = await supabase
        .from("service_providers")
        .select("*")
        .in("user_id", providerIds);
      const provMap: Record<string, ServiceProvider> = {};
      (provs ?? []).forEach((p) => (provMap[(p as ServiceProvider).user_id ?? ""] = p as ServiceProvider));

      return rows.map((r) => ({
        ...r,
        service: r.service_id ? services[r.service_id] ?? null : null,
        provider: r.provider_id ? provMap[r.provider_id] ?? null : null,
        customer: null,
      }));
    },
  });
}

// Bookings RECEIVED by the signed-in provider (provider_id = my user id).
export function useProviderBookings() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["provider-bookings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<BookingView[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("provider_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Booking[];
      if (rows.length === 0) return [];

      const services = await fetchServices(rows.map((r) => r.service_id ?? "").filter(Boolean));
      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id ?? "").filter(Boolean)));
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", customerIds);
      const custMap: Record<string, Profile> = {};
      (profiles ?? []).forEach((p) => (custMap[(p as Profile).id] = p as Profile));

      return rows.map((r) => ({
        ...r,
        service: r.service_id ? services[r.service_id] ?? null : null,
        provider: null,
        customer: r.customer_id ? custMap[r.customer_id] ?? null : null,
      }));
    },
  });
}

export function useBookingActions() {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-bookings", userId] });
    qc.invalidateQueries({ queryKey: ["provider-bookings", userId] });
  };

  const create = useMutation({
    mutationFn: (input: CreateBookingInput) => {
      if (!userId) throw new Error("Please sign in to book.");
      return createBooking(input, userId);
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: ({
      id,
      status,
      decline_reason,
    }: {
      id: string;
      status: BookingStatus;
      decline_reason?: string;
    }) => setBookingStatus(id, status, decline_reason ? { decline_reason } : undefined),
    onSuccess: invalidate,
  });

  // Provider accepts → server CAPTURES the held funds (authorized → captured).
  const accept = useMutation({
    mutationFn: (id: string) => acceptBooking(id),
    onSuccess: invalidate,
  });

  // Provider declines → server RELEASES the authorization (hold returned).
  const decline = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => declineBooking(id, reason),
    onSuccess: invalidate,
  });

  // Customer cancels their own pending request → server RELEASES the hold.
  const cancel = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: invalidate,
  });

  return { create, updateStatus, accept, decline, cancel };
}
