// Platform fee — the single source of truth (mirrored in webapp/src/lib for display).
//
// Rule (Phase 4): 8% of each ITEM, clamped between $0.99 and $12.99 PER ITEM.
//   - Buyer pays:      item price + platform fee
//   - Creator receives: item price          (Stripe transfer_data.destination)
//   - Platform receives: platform fee        (Stripe application_fee_amount)
//
// For multiple tickets the fee is computed PER TICKET and then summed — never
// 8% of the whole cart. A 10× $5 order is therefore 10× the $0.99 floor, not
// 8% of $50.

export const FEE_RATE = 0.08;
export const FEE_MIN_CENTS = 99; //  $0.99
export const FEE_MAX_CENTS = 1299; // $12.99

// Per-item platform fee in cents. Free items ($0) carry no fee.
export function perItemFeeCents(priceCents: number): number {
  const price = Math.max(0, Math.round(priceCents || 0));
  if (price <= 0) return 0;
  return Math.min(FEE_MAX_CENTS, Math.max(FEE_MIN_CENTS, Math.round(price * FEE_RATE)));
}

export interface LineFee {
  unit_price_cents: number;
  quantity: number;
  unit_fee_cents: number; // fee for ONE item
  line_price_cents: number; // unit_price * qty (creator's portion for the line)
  line_fee_cents: number; // unit_fee * qty (platform's portion for the line)
}

// Compute per-line creator/platform splits for a multi-item cart (tickets).
export function lineFees(
  items: Array<{ price_cents: number; quantity: number }>,
): { lines: LineFee[]; subtotal_cents: number; fee_cents: number; total_cents: number } {
  const lines: LineFee[] = items.map((it) => {
    const unit_price_cents = Math.max(0, Math.round(it.price_cents || 0));
    const quantity = Math.max(0, Math.round(it.quantity || 0));
    const unit_fee_cents = perItemFeeCents(unit_price_cents);
    return {
      unit_price_cents,
      quantity,
      unit_fee_cents,
      line_price_cents: unit_price_cents * quantity,
      line_fee_cents: unit_fee_cents * quantity,
    };
  });
  const subtotal_cents = lines.reduce((s, l) => s + l.line_price_cents, 0);
  const fee_cents = lines.reduce((s, l) => s + l.line_fee_cents, 0);
  return { lines, subtotal_cents, fee_cents, total_cents: subtotal_cents + fee_cents };
}

// Single-item breakdown (service booking).
export function singleBreakdown(priceCents: number): {
  service_price_cents: number;
  platform_fee_cents: number;
  amount_total: number;
} {
  const service_price_cents = Math.max(0, Math.round(priceCents || 0));
  const platform_fee_cents = perItemFeeCents(service_price_cents);
  return {
    service_price_cents,
    platform_fee_cents,
    amount_total: service_price_cents + platform_fee_cents,
  };
}
