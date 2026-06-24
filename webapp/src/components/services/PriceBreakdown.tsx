import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/helpers";
import { priceBreakdown } from "@/lib/services";

// Shared service + platform-fee + total summary used in booking & checkout.
export function PriceBreakdown({ priceCents }: { priceCents: number }) {
  const b = priceBreakdown(priceCents);
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <div className="flex items-center justify-between py-1">
        <span className="text-muted-foreground">Service</span>
        <span className="font-medium">{formatPrice(b.service_price_cents)}</span>
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-muted-foreground">Platform fee</span>
        <span className="font-medium">{formatPrice(b.platform_fee_cents)}</span>
      </div>
      <Separator className="my-2" />
      <div className="flex items-center justify-between py-1">
        <span className="font-semibold">Total</span>
        <span className="font-heading text-lg font-bold">{formatPrice(b.amount_total)}</span>
      </div>
    </div>
  );
}
