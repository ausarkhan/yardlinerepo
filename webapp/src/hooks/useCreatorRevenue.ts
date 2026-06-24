import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { fetchOrdersForHost, type OrderRow } from "@/lib/orders";
import type { Booking } from "@/lib/services";

export interface RecentTransaction {
  id: string;
  kind: "ticket" | "booking";
  title: string;
  amount_cents: number;
  payment_status: string;
  created_at: string | null;
}

export interface CreatorRevenue {
  ticketRevenueCents: number; // creator's portion (subtotal), paid orders
  serviceRevenueCents: number; // captured bookings
  pendingBookingRevenueCents: number; // authorized / pending bookings
  paidOrders: OrderRow[];
  bookings: Booking[];
  recent: RecentTransaction[];
}

// All money figures for the signed-in creator. Revenue from yardtix_orders
// degrades to 0 when the table is missing; bookings always read from `bookings`.
export function useCreatorRevenue() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ["creator-revenue", userId],
    enabled: !!userId,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<CreatorRevenue> => {
      // Ticket orders for events this user hosts (graceful when table absent).
      const orders = await fetchOrdersForHost(userId as string);
      const paidOrders = orders.filter((o) => o.payment_status === "paid");
      const ticketRevenueCents = paidOrders.reduce((sum, o) => sum + (o.subtotal_cents ?? 0), 0);

      // Bookings received as a provider.
      let bookings: Booking[] = [];
      try {
        const { data } = await supabase
          .from("bookings")
          .select("*")
          .eq("provider_id", userId)
          .order("created_at", { ascending: false });
        bookings = (data ?? []) as Booking[];
      } catch {
        bookings = [];
      }

      const serviceRevenueCents = bookings
        .filter((b) => b.payment_status === "captured")
        .reduce((sum, b) => sum + (b.service_price_cents ?? 0), 0);

      const pendingBookingRevenueCents = bookings
        .filter(
          (b) => b.payment_status === "authorized" || b.status === "pending_provider_review",
        )
        .reduce((sum, b) => sum + (b.service_price_cents ?? 0), 0);

      // Recent transactions (orders + bookings), newest first.
      const txns: RecentTransaction[] = [
        ...paidOrders.map((o) => ({
          id: o.id,
          kind: "ticket" as const,
          title: o.order_number ? `Ticket order ${o.order_number}` : "Ticket order",
          amount_cents: o.total_cents ?? o.subtotal_cents ?? 0,
          payment_status: o.payment_status ?? "paid",
          created_at: o.created_at,
        })),
        ...bookings.map((b) => ({
          id: b.id,
          kind: "booking" as const,
          title: "Service booking",
          amount_cents: b.amount_total ?? b.service_price_cents ?? 0,
          payment_status: b.payment_status ?? "none",
          created_at: b.created_at,
        })),
      ].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      return {
        ticketRevenueCents,
        serviceRevenueCents,
        pendingBookingRevenueCents,
        paidOrders,
        bookings,
        recent: txns.slice(0, 10),
      };
    },
  });
}
