import { z } from "zod";

// ---------------------------------------------------------------------------
// API contracts — single source of truth shared by backend + webapp.
// ---------------------------------------------------------------------------

// Phase 4 — Stripe-shaped payments for service bookings.
//
// The `bookings` table is already Stripe-ready (payment_intent_id /
// payment_status / amount_total). This endpoint creates a PaymentIntent for a
// booking. When STRIPE_SECRET_KEY is configured it would call Stripe; without a
// key (this environment) it returns a clearly-marked test intent so the full
// checkout flow works end-to-end and is ready to swap in live keys later.

export const CreatePaymentIntentRequest = z.object({
  amount_cents: z.number().int().positive(),
  currency: z.string().default("usd"),
  booking_id: z.string().optional(),
});
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentRequest>;

export const PaymentIntentResponse = z.object({
  id: z.string(), // pi_...
  client_secret: z.string(), // pi_..._secret_...
  amount_cents: z.number().int(),
  currency: z.string(),
  status: z.string(), // requires_payment_method | succeeded | ...
  test_mode: z.boolean(),
});
export type PaymentIntentResponse = z.infer<typeof PaymentIntentResponse>;

// ---------------------------------------------------------------------------
// Phase 3 — Stripe Connect onboarding for creators (event hosts & providers).
//
// The existing `stripe_connect_accounts` table stores the account state. The
// backend (which holds STRIPE_SECRET_KEY) creates/refreshes the Connect account
// and hosted onboarding link; the webapp reads status from Supabase and kicks
// off onboarding through these endpoints.
// ---------------------------------------------------------------------------

// The four creator-facing payment states surfaced in the Payments tab.
export const ConnectStatus = z.enum([
  "not_activated",
  "pending_verification",
  "restricted",
  "active",
]);
export type ConnectStatus = z.infer<typeof ConnectStatus>;

export const ConnectStatusResponse = z.object({
  status: ConnectStatus,
  account_id: z.string().nullable(),
  charges_enabled: z.boolean(),
  payouts_enabled: z.boolean(),
  details_submitted: z.boolean(),
  updated_at: z.string().nullable(),
  test_mode: z.boolean(),
  // Populated when Connect can't run (e.g. not enabled on the platform account).
  message: z.string().nullable().optional(),
});
export type ConnectStatusResponse = z.infer<typeof ConnectStatusResponse>;

// The webapp passes its origin so the backend can build absolute return/refresh
// URLs back into the dashboard.
export const ConnectOnboardRequest = z.object({
  origin: z.string().url(),
});
export type ConnectOnboardRequest = z.infer<typeof ConnectOnboardRequest>;

export const ConnectOnboardResponse = z.object({
  url: z.string().nullable(), // Stripe-hosted onboarding link, or null on failure
  message: z.string().nullable().optional(),
});
export type ConnectOnboardResponse = z.infer<typeof ConnectOnboardResponse>;

// ---------------------------------------------------------------------------
// Phase 4 — Event ticket checkout (instant purchase via Stripe Checkout).
//
// Buyer selects tiers+quantities; the backend prices them server-side (never
// trusting client prices), creates a yardtix_orders row + a Stripe Checkout
// Session (destination charge to the host), and returns the hosted URL. Tickets
// are only issued by the checkout.session.completed webhook.
// ---------------------------------------------------------------------------

export const EventCheckoutItem = z.object({
  tier_id: z.string(),
  quantity: z.number().int().positive(),
});
export type EventCheckoutItem = z.infer<typeof EventCheckoutItem>;

export const EventCheckoutRequest = z.object({
  event_id: z.string().uuid(),
  items: z.array(EventCheckoutItem).min(1),
  origin: z.string().url(),
});
export type EventCheckoutRequest = z.infer<typeof EventCheckoutRequest>;

export const EventCheckoutResponse = z.object({
  url: z.string().nullable(), // Stripe Checkout URL to redirect to
  session_id: z.string().nullable(),
  order_id: z.string().nullable(),
  message: z.string().nullable().optional(), // set when blocked (not configured / host not active)
});
export type EventCheckoutResponse = z.infer<typeof EventCheckoutResponse>;

// ---------------------------------------------------------------------------
// Phase 4 — Service booking authorization (manual-capture PaymentIntent).
//
// The customer enters card details at REQUEST time; the card is AUTHORIZED but
// not captured. Funds are captured only when the provider accepts; cancelled
// (released) if the provider declines.
// ---------------------------------------------------------------------------

export const BookingIntentRequest = z.object({
  service_id: z.string().uuid(),
  provider_user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time_start: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/), // HH:MM or HH:MM:SS
});
export type BookingIntentRequest = z.infer<typeof BookingIntentRequest>;

export const BookingIntentResponse = z.object({
  booking_id: z.string().nullable(),
  client_secret: z.string().nullable(), // PaymentIntent client secret for Stripe Elements
  service_price_cents: z.number().int(),
  platform_fee_cents: z.number().int(),
  amount_total: z.number().int(),
  test_mode: z.boolean(),
  message: z.string().nullable().optional(),
});
export type BookingIntentResponse = z.infer<typeof BookingIntentResponse>;

// Provider accept/decline result.
export const BookingActionResponse = z.object({
  booking_id: z.string(),
  status: z.string(), // confirmed | declined
  payment_status: z.string(), // captured | none
  message: z.string().nullable().optional(),
});
export type BookingActionResponse = z.infer<typeof BookingActionResponse>;

// ---------------------------------------------------------------------------
// Phase 4 — Checkout/session status polling (receipt page).
// ---------------------------------------------------------------------------

export const SessionStatusResponse = z.object({
  order_id: z.string().nullable(),
  payment_status: z.string(), // pending | paid | failed | cancelled | refunded
  ticket_count: z.number().int(),
  receipt_url: z.string().nullable(),
});
export type SessionStatusResponse = z.infer<typeof SessionStatusResponse>;

// ---------------------------------------------------------------------------
// Phase 5 — Ticket check-in (host-facing QR scan / manual lookup).
//
// Each yardtix_tickets row carries a qr_token (UUID, rendered as a scannable QR
// on the holder's ticket) and a ticket_number (YT-YYYY-NNNNNN, for manual entry
// when a camera isn't available). A host scans/enters one of these; the backend
// (service role) verifies the ticket belongs to one of the caller's events,
// isn't already used, and is admissible, then stamps status='used' + used_at.
//
// This MUST run server-side: RLS only grants holders update on their own tickets
// ("tickets: holder update"), so a host marking another user's ticket used is
// only possible through the service-role backend.
// ---------------------------------------------------------------------------

export const CheckinScanRequest = z
  .object({
    // Provide at least one. qr_token is the scanned UUID; ticket_number is the
    // human-readable code for manual entry.
    qr_token: z.string().uuid().optional(),
    ticket_number: z.string().optional(),
    // Optional guard: the event the host is actively checking in for. When set,
    // a ticket belonging to a different event returns result 'wrong_event'
    // instead of being admitted.
    event_id: z.string().uuid().optional(),
  })
  .refine((d) => !!d.qr_token || !!d.ticket_number, {
    message: "Provide a qr_token or a ticket_number",
  });
export type CheckinScanRequest = z.infer<typeof CheckinScanRequest>;

export const CheckinResultCode = z.enum([
  "ok", // newly checked in by this scan
  "already_used", // valid ticket, but it was already checked in
  "not_found", // no ticket matches the qr_token / ticket_number
  "wrong_event", // ticket is for a different event than event_id
  "not_authorized", // caller is not the host of the ticket's event
  "invalid_status", // ticket is refunded/cancelled — not admissible
]);
export type CheckinResultCode = z.infer<typeof CheckinResultCode>;

export const CheckinTicket = z.object({
  id: z.string(),
  ticket_number: z.string(),
  event_id: z.string(),
  event_title: z.string().nullable(),
  holder_id: z.string(),
  holder_name: z.string().nullable(), // joined from profiles when available
  tier_name: z.string().nullable(),
  status: z.string(), // confirmed | used | refunded | cancelled
  used_at: z.string().nullable(), // ISO timestamp once checked in
});
export type CheckinTicket = z.infer<typeof CheckinTicket>;

export const CheckinScanResponse = z.object({
  result: CheckinResultCode,
  ticket: CheckinTicket.nullable(), // present for ok / already_used / wrong_event / invalid_status
  message: z.string().nullable().optional(),
});
export type CheckinScanResponse = z.infer<typeof CheckinScanResponse>;

// GET /api/checkin/event/:eventId/summary — host roster + live counts.
export const CheckinSummaryResponse = z.object({
  event_id: z.string(),
  total: z.number().int(), // admissible tickets (confirmed + used)
  checked_in: z.number().int(), // used
  remaining: z.number().int(), // total - checked_in
  tickets: z.array(CheckinTicket),
});
export type CheckinSummaryResponse = z.infer<typeof CheckinSummaryResponse>;
