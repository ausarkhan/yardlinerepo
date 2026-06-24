import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { getSessionStatus } from "@/lib/checkout";
import {
  fetchOrderById,
  fetchTicketsForOrder,
  type OrderRow,
  type TicketRow,
} from "@/lib/orders";
import type { Booking } from "@/lib/services";
import type { YardEvent, Profile, Service, ServiceProvider } from "@/lib/types";

// ---- Ticket order receipt --------------------------------------------------

export interface TicketReceipt {
  order: OrderRow | null;
  tickets: TicketRow[];
  event: YardEvent | null;
  buyer: Profile | null;
  host: Profile | null;
}

async function safeProfile(id: string | null | undefined): Promise<Profile | null> {
  if (!id) return null;
  try {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}

async function safeEvent(id: string | null | undefined): Promise<YardEvent | null> {
  if (!id) return null;
  try {
    const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    return (data as YardEvent) ?? null;
  } catch {
    return null;
  }
}

// Poll the backend until the webhook marks the order paid, THEN read the rich
// order/ticket rows (which only exist once the migration is applied — degraded
// gracefully to nulls/empty otherwise).
export function useTicketReceipt(orderId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  // 1) Live payment status (backend, always available).
  const statusQuery = useQuery({
    queryKey: ["session-status", orderId],
    enabled: !!orderId,
    refetchInterval: (query) => {
      const s = query.state.data?.payment_status;
      return s === "paid" ? false : 2000;
    },
    queryFn: () => getSessionStatus(orderId as string),
  });

  const isPaid = statusQuery.data?.payment_status === "paid";

  // 2) Once paid, surface the new tickets in My YardTix without a refresh.
  useEffect(() => {
    if (isPaid) qc.invalidateQueries({ queryKey: ["my-yardtix", userId] });
  }, [isPaid, qc, userId]);

  // 3) The rich receipt rows (graceful if tables are missing).
  const receiptQuery = useQuery({
    queryKey: ["ticket-receipt", orderId, isPaid],
    enabled: !!orderId && isPaid,
    queryFn: async (): Promise<TicketReceipt> => {
      const order = await fetchOrderById(orderId as string);
      const tickets = order ? await fetchTicketsForOrder(order.id) : [];
      const event = await safeEvent(order?.event_id);
      const buyer = await safeProfile(order?.buyer_id);
      const host = await safeProfile(order?.host_id ?? event?.host_id);
      return { order, tickets, event, buyer, host };
    },
  });

  return { statusQuery, receiptQuery, isPaid };
}

// ---- Service booking receipt ----------------------------------------------

export interface BookingReceipt {
  booking: Booking | null;
  service: Service | null;
  provider: ServiceProvider | null;
  customer: Profile | null;
}

export function useBookingReceipt(bookingId: string | null) {
  return useQuery({
    queryKey: ["booking-receipt", bookingId],
    enabled: !!bookingId,
    refetchInterval: (query) => {
      // Keep polling briefly until the authorization/capture settles.
      const ps = query.state.data?.booking?.payment_status;
      return ps === "captured" || ps === "failed" ? false : 3000;
    },
    queryFn: async (): Promise<BookingReceipt> => {
      const { data: bRow } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();
      const booking = (bRow as Booking) ?? null;
      if (!booking) return { booking: null, service: null, provider: null, customer: null };

      let service: Service | null = null;
      if (booking.service_id) {
        const { data } = await supabase
          .from("services")
          .select("*")
          .eq("service_id", booking.service_id)
          .maybeSingle();
        service = (data as Service) ?? null;
      }

      let provider: ServiceProvider | null = null;
      if (booking.provider_id) {
        const { data } = await supabase
          .from("service_providers")
          .select("*")
          .eq("user_id", booking.provider_id)
          .maybeSingle();
        provider = (data as ServiceProvider) ?? null;
      }

      const customer = await safeProfile(booking.customer_id);
      return { booking, service, provider, customer };
    },
  });
}
