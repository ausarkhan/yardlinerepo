import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Minus, Plus, Ticket, Loader2, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useEventCapacity, useMyAttendance } from "@/hooks/useTicketing";
import { useAuthStore } from "@/store/auth";
import { eventTiers } from "@/lib/events";
import { formatPrice } from "@/lib/helpers";
import { ticketCartFees } from "@/lib/yardtix";
import { createEventSession } from "@/lib/checkout";
import { isStripeConfigured } from "@/lib/stripeClient";
import { useWaiverGate } from "@/hooks/useWaiverGate";
import type { YardEvent } from "@/lib/types";
import { toast } from "sonner";

export function TicketCard({ event }: { event: YardEvent }) {
  const user = useAuthStore((s) => s.user);
  const tiers = eventTiers(event);
  const fallback =
    tiers.length === 0
      ? [
          {
            id: "general",
            name: "General Admission",
            price_cents: Math.round(Number(event.ticket_price ?? 0) * 100),
            max_per_buyer: 6,
            sold: event.tickets_sold ?? 0,
            capacity: event.max_tickets ?? undefined,
          },
        ]
      : tiers;

  const { data: capacity } = useEventCapacity(event.id);
  const { data: mine } = useMyAttendance(event.id);
  const [qty, setQty] = useState<Record<string, number>>({});

  const stripeReady = isStripeConfigured();
  const myTickets = (mine ?? []).filter((r) => r.source === "ticket").length;
  const sold = capacity?.tickets ?? event.tickets_sold ?? 0;
  const cap = event.max_tickets ?? null;
  const soldOut = cap != null && sold >= cap;

  const set = (id: string, n: number, max: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(max, n)) }));

  const totalSelected = Object.values(qty).reduce((a, b) => a + b, 0);

  // Per-ticket fee, summed across the cart (NOT 8% of the cart total).
  const fees = ticketCartFees(
    fallback.map((t) => ({ price_cents: t.price_cents ?? 0, quantity: qty[t.id] ?? 0 })),
  );

  const checkout = useMutation({
    mutationFn: async () => {
      const items = fallback
        .filter((t) => (qty[t.id] ?? 0) > 0)
        .map((t) => ({ tier_id: t.id, quantity: qty[t.id] ?? 0 }));
      return createEventSession(event.id, items);
    },
    onSuccess: (res) => {
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      toast.message(res.message ?? "The host hasn’t activated payments yet.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start checkout"),
  });

  const { run: gatePurchase, gate: purchaseGate } = useWaiverGate("buy tickets");

  function handlePurchase() {
    if (!user) {
      toast.error("Please sign in to buy tickets.");
      return;
    }
    if (!stripeReady) {
      toast.error("Online payments aren’t enabled yet.");
      return;
    }
    if (totalSelected < 1) return;
    // Purchasing a ticket is gated behind legal acceptance.
    gatePurchase(() => checkout.mutate());
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Ticket className="h-4 w-4" />
          Get tickets
        </div>
        {myTickets > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green/15 px-2.5 py-1 text-xs font-semibold text-green">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {myTickets} reserved
          </span>
        ) : null}
      </div>

      {cap != null ? (
        <div className="mt-4 space-y-1.5">
          <Progress value={Math.min(100, (sold / cap) * 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {Math.max(0, cap - sold)} of {cap} tickets remaining
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {fallback.map((t) => {
          const remaining = t.capacity != null ? Math.max(0, t.capacity - (t.sold ?? 0)) : null;
          const tierSoldOut = remaining === 0;
          const perBuyer = t.max_per_buyer ?? 6;
          return (
            <div key={t.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{t.name}</p>
                  {t.description ? (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  ) : null}
                  <p className="mt-1 text-sm font-medium">
                    {t.price_cents === 0 ? "Free" : formatPrice(t.price_cents)}
                  </p>
                  {remaining != null ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tierSoldOut ? "Sold out" : `${remaining} left`}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    disabled={(qty[t.id] ?? 0) <= 0}
                    onClick={() => set(t.id, (qty[t.id] ?? 0) - 1, perBuyer)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center font-semibold">{qty[t.id] ?? 0}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    disabled={tierSoldOut || soldOut || (qty[t.id] ?? 0) >= perBuyer}
                    onClick={() => set(t.id, (qty[t.id] ?? 0) + 1, perBuyer)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Separator className="my-5" />

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>
            Subtotal · {totalSelected} ticket{totalSelected === 1 ? "" : "s"}
          </span>
          <span className="font-medium text-foreground">{formatPrice(fees.subtotal_cents)}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Service fee</span>
          <span className="font-medium text-foreground">{formatPrice(fees.fee_cents)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="font-heading text-xl font-bold">{formatPrice(fees.total_cents)}</span>
        </div>
      </div>

      <Button
        onClick={handlePurchase}
        disabled={!stripeReady || totalSelected < 1 || checkout.isPending || soldOut}
        className="mt-4 h-12 w-full text-base font-semibold"
      >
        {checkout.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : soldOut ? (
          "Sold out"
        ) : !stripeReady ? (
          <>
            <Lock className="h-5 w-5" />
            Payments unavailable
          </>
        ) : (
          <>
            <Ticket className="h-5 w-5" />
            Buy tickets
          </>
        )}
      </Button>
      {!stripeReady ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Online payments aren’t enabled yet.
        </p>
      ) : (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secure checkout powered by Stripe. Tickets appear in My YardTix after payment.
        </p>
      )}
      {purchaseGate}
    </div>
  );
}
