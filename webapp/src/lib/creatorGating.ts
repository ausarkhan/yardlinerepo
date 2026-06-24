// Creator access rules — payments must be active before money can move.
//
//   Paid events    cannot be PUBLISHED unless payments are active.
//   Paid services  cannot ACCEPT paid bookings unless payments are active.
//   Free events / free services are always allowed.
//
// (See lib/stripeConnect.ts for status; the dashboard renders the reasons.)

import type { ConnectStatusResponse } from "./stripeConnect";
import type { YardEvent, Service } from "./types";

export function paymentsActive(status: ConnectStatusResponse | null | undefined): boolean {
  return status?.status === "active";
}

export interface GateResult {
  ok: boolean;
  reason?: string;
}

const ACTIVATE_HINT = "Activate payments in the Payments tab to enable this.";

// Free events have is_free === true OR no positive ticket price.
export function isFreeEvent(event: Pick<YardEvent, "is_free" | "ticket_price">): boolean {
  if (event.is_free) return true;
  return !event.ticket_price || event.ticket_price <= 0;
}

export function canPublishEvent(
  event: Pick<YardEvent, "is_free" | "ticket_price">,
  status: ConnectStatusResponse | null | undefined,
): GateResult {
  if (isFreeEvent(event)) return { ok: true };
  if (paymentsActive(status)) return { ok: true };
  return { ok: false, reason: `Paid events need active payments to publish. ${ACTIVATE_HINT}` };
}

export function isFreeService(service: Pick<Service, "price_cents">): boolean {
  return !service.price_cents || service.price_cents <= 0;
}

export function canAcceptPaidBooking(
  service: Pick<Service, "price_cents"> | null | undefined,
  status: ConnectStatusResponse | null | undefined,
): GateResult {
  if (!service || isFreeService(service)) return { ok: true };
  if (paymentsActive(status)) return { ok: true };
  return { ok: false, reason: `Paid bookings need active payments to accept. ${ACTIVATE_HINT}` };
}
