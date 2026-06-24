// YardTix domain layer.
//
// Phase 2 persists participation in the existing `event_attendees` table
// (source = 'rsvp' | 'ticket'). The richer yardtix_orders / yardtix_tickets
// tables ship as a migration (supabase/migrations/0001_*) for Phase 4.
// Ticket/order numbers are therefore DERIVED deterministically from the
// attendee row id so they are stable across reloads and match the formats
// YT-YYYY-NNNNNN / YO-YYYY-NNNNNN.

import type { YardEvent } from "./types";

export const EVENT_STATUSES = [
  "draft",
  "published",
  "sales_ended",
  "cancelled",
  "postponed",
  "completed",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const TICKET_STATUSES = [
  "created",
  "confirmed",
  "used",
  "refunded",
  "cancelled",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type AttendeeSource = "rsvp" | "ticket";

export interface RefundPolicy {
  type: "no_refunds" | "flexible" | "custom";
  note?: string;
}

export const REFUND_POLICIES: { value: RefundPolicy["type"]; label: string; desc: string }[] = [
  { value: "no_refunds", label: "No refunds", desc: "All sales are final." },
  { value: "flexible", label: "Flexible", desc: "Full refund up to 24h before the event." },
  { value: "custom", label: "Custom", desc: "Describe your own refund terms." },
];

// Per-ticket platform fee: 8% clamped to $0.99–$12.99 PER TICKET.
// For a multi-ticket cart, fee = sum of per-ticket fees (never 8% of the cart).
// Mirror of backend/src/lib/fees.ts (the authoritative source).
export function perTicketFeeCents(priceCents: number): number {
  if (!priceCents || priceCents <= 0) return 0;
  return Math.min(1299, Math.max(99, Math.round(priceCents * 0.08)));
}

// Sum per-ticket fees across a cart of { price_cents, quantity } lines.
export function ticketCartFees(items: Array<{ price_cents: number; quantity: number }>): {
  subtotal_cents: number;
  fee_cents: number;
  total_cents: number;
} {
  let subtotal_cents = 0;
  let fee_cents = 0;
  for (const it of items) {
    const price = Math.max(0, Math.round(it.price_cents || 0));
    const qty = Math.max(0, Math.round(it.quantity || 0));
    subtotal_cents += price * qty;
    fee_cents += perTicketFeeCents(price) * qty;
  }
  return { subtotal_cents, fee_cents, total_cents: subtotal_cents + fee_cents };
}

// A ticket tier stored inside events.ticket_types (jsonb).
export interface Tier {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  capacity?: number;
  max_per_buyer?: number;
  sales_start?: string;
  sales_end?: string;
  sold?: number;
}

// Raw event_attendees row.
export interface AttendeeRow {
  id: string;
  event_id: string;
  user_id: string;
  source: AttendeeSource | string | null;
  created_at: string | null;
}

// Assembled "YardTix" view-model for My YardTix / attendee lists.
export interface YardTix {
  id: string;
  eventId: string;
  userId: string;
  kind: AttendeeSource;
  ticketNumber: string;
  orderNumber: string;
  status: TicketStatus;
  qrToken: string;
  createdAt: string | null;
  event?: YardEvent;
}

// FNV-1a hash → stable 6-digit suffix from a uuid.
function digits6(seed: string, salt: string): string {
  let h = 0x811c9dc5;
  const s = salt + seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return String((h >>> 0) % 1000000).padStart(6, "0");
}

function yearOf(createdAt: string | null): string {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) return String(d.getFullYear());
  }
  return "2026";
}

export function ticketNumber(rowId: string, createdAt: string | null): string {
  return `YT-${yearOf(createdAt)}-${digits6(rowId, "ticket")}`;
}

export function orderNumber(rowId: string, createdAt: string | null): string {
  return `YO-${yearOf(createdAt)}-${digits6(rowId, "order")}`;
}

// Lightweight deterministic QR token (placeholder; real scanning is later).
export function qrToken(rowId: string): string {
  return `${digits6(rowId, "qr-a")}${digits6(rowId, "qr-b")}`;
}

export function attendeeToYardTix(row: AttendeeRow, event?: YardEvent): YardTix {
  const kind: AttendeeSource = row.source === "ticket" ? "ticket" : "rsvp";
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    kind,
    ticketNumber: ticketNumber(row.id, row.created_at),
    orderNumber: orderNumber(row.id, row.created_at),
    status: kind === "rsvp" ? "confirmed" : "created",
    qrToken: qrToken(row.id),
    createdAt: row.created_at,
    event,
  };
}

// ---- status display helpers ------------------------------------------------

export function ticketStatusStyle(status: TicketStatus): string {
  switch (status) {
    case "confirmed":
      return "bg-green/15 text-green border-green/30";
    case "used":
      return "bg-muted text-muted-foreground border-border";
    case "refunded":
      return "bg-secondary/15 text-secondary border-secondary/30";
    case "cancelled":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "created":
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
}

export function eventStatusStyle(status: string): string {
  switch (status) {
    case "published":
      return "bg-green/15 text-green border-green/30";
    case "draft":
      return "bg-muted text-muted-foreground border-border";
    case "cancelled":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "sales_ended":
    case "completed":
      return "bg-secondary/15 text-secondary border-secondary/30";
    case "postponed":
      return "bg-primary/15 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function eventStatusLabel(status: string | null | undefined): string {
  if (!status) return "Draft";
  return status
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
