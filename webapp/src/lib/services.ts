// Services marketplace domain layer (Phase 3 + Phase 4).
//
// Maps onto the existing Supabase tables — nothing is renamed or dropped:
//   service_providers  — one row per provider (keyed by user_id)
//   services           — a provider's menu (services.provider_id → users.id, the
//                        provider's USER id, NOT the service_providers row id)
//   bookings           — one row per booking request/checkout. Already Stripe-shaped
//                        (payment_intent_id / payment_status / amount_total), which is
//                        why Phase 4 checkout lives here.
//
// Verified live CHECK constraints (so writes never 23514):
//   bookings.status         : requested | pending | confirmed | declined | cancelled | checkout_created
//   bookings.payment_status : none | authorized | captured | failed   ("captured" == paid)
//
// Phase 3 expands the lifecycle with pending_provider_review | completed |
// refund_pending | refunded (see supabase/migrations/0002_booking_lifecycle.sql).
// Those four only become writable once that migration is applied in Supabase;
// the request/confirm/decline flow below uses the already-allowed values.
//
// Platform fee matches the mobile app's observed ledger: 8% with a 99¢ floor.

import { supabase } from "./supabase";
import type { Profile, ServiceProvider, Service, EmbeddedUser } from "./types";

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

// Platform fee: 8% of the item, clamped between $0.99 and $12.99.
// Mirror of backend/src/lib/fees.ts (the authoritative source).
export function platformFeeCents(priceCents: number): number {
  if (!priceCents || priceCents <= 0) return 0;
  return Math.min(1299, Math.max(99, Math.round(priceCents * 0.08)));
}

export interface PriceBreakdown {
  service_price_cents: number;
  platform_fee_cents: number;
  amount_total: number;
}

export function priceBreakdown(priceCents: number): PriceBreakdown {
  const service_price_cents = Math.max(0, Math.round(priceCents || 0));
  const platform_fee_cents = platformFeeCents(service_price_cents);
  return {
    service_price_cents,
    platform_fee_cents,
    amount_total: service_price_cents + platform_fee_cents,
  };
}

// ---------------------------------------------------------------------------
// Booking status
// ---------------------------------------------------------------------------

export const BOOKING_STATUSES = [
  "requested",
  "pending",
  "pending_provider_review",
  "confirmed",
  "declined",
  "cancelled",
  "checkout_created",
  "completed",
  "refund_pending",
  "refunded",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Statuses added by Phase 3 that require migration 0002 to be applied in Supabase
// before they can be written. Used to give a clear message instead of a raw 23514.
export const MIGRATION_GATED_STATUSES: BookingStatus[] = [
  "pending_provider_review",
  "completed",
  "refund_pending",
  "refunded",
];

export const PAYMENT_STATUSES = ["none", "authorized", "captured", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Human label for a booking's payment_status (authorize-not-charge lifecycle).
export function paymentStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "authorized":
      return "Authorized · not charged";
    case "captured":
    case "paid":
      return "Paid";
    case "failed":
      return "Payment failed";
    case "pending":
      return "Pending";
    case "none":
    default:
      return "No payment";
  }
}

export function paymentStatusStyle(status: string | null | undefined): string {
  switch (status) {
    case "captured":
    case "paid":
      return "bg-green/15 text-green border-green/30";
    case "authorized":
    case "pending":
      return "bg-primary/15 text-primary border-primary/30";
    case "failed":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "none":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function bookingStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "requested":
    case "pending":
    case "pending_provider_review":
      return "Pending review";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "checkout_created":
      return "Awaiting payment";
    case "refund_pending":
      return "Refund pending";
    case "refunded":
      return "Refunded";
    default:
      return "Pending review";
  }
}

export function bookingStatusStyle(status: string | null | undefined): string {
  switch (status) {
    case "confirmed":
    case "completed":
      return "bg-green/15 text-green border-green/30";
    case "declined":
    case "cancelled":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "checkout_created":
    case "refund_pending":
      return "bg-secondary/15 text-secondary border-secondary/30";
    case "refunded":
      return "bg-muted text-muted-foreground border-border";
    case "requested":
    case "pending":
    case "pending_provider_review":
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
}

// A pending request the provider still needs to act on.
export function isPendingRequest(status: string | null | undefined): boolean {
  return (
    status === "requested" ||
    status === "pending" ||
    status === "pending_provider_review"
  );
}

// A booking the provider has accepted but not yet fulfilled.
export function isUpcoming(status: string | null | undefined): boolean {
  return status === "confirmed" || status === "checkout_created";
}

// The customer may cancel their own request only while it's still pending and
// the card hasn't been captured (mirror of the backend's CUSTOMER_CANCELABLE).
export function canCustomerCancel(
  status: string | null | undefined,
  paymentStatus: string | null | undefined,
): boolean {
  return isPendingRequest(status) && paymentStatus !== "captured";
}

// ---------------------------------------------------------------------------
// Booking lifecycle (the buyer's authorize-not-charge journey)
// ---------------------------------------------------------------------------

export interface LifecycleStep {
  key: string;
  label: string;
  description: string;
}

// The canonical happy-path the buyer moves through.
export const LIFECYCLE_STEPS: LifecycleStep[] = [
  { key: "requested", label: "Requested", description: "You sent the booking request." },
  { key: "review", label: "Provider review", description: "Card authorized — you're not charged yet." },
  { key: "confirmed", label: "Confirmed & paid", description: "Provider accepted; your card was charged." },
  { key: "completed", label: "Completed", description: "Service delivered." },
];

export type LifecycleOutcome = "active" | "declined" | "cancelled" | "refunded";

// How far along the 4 steps a booking has reached.
//   reachedIndex — index of the last COMPLETED step (-1 = none yet)
//   outcome      — "active" on the happy path, otherwise the terminal branch
export function lifecycleProgress(
  status: string | null | undefined,
  paymentStatus: string | null | undefined,
): { reachedIndex: number; outcome: LifecycleOutcome } {
  switch (status) {
    case "completed":
      return { reachedIndex: 3, outcome: "active" };
    case "confirmed":
    case "checkout_created":
      return { reachedIndex: 2, outcome: "active" };
    case "refund_pending":
    case "refunded":
      return { reachedIndex: 2, outcome: "refunded" };
    case "declined":
      return { reachedIndex: 0, outcome: "declined" };
    case "cancelled":
      return { reachedIndex: 0, outcome: "cancelled" };
    case "requested":
    case "pending":
    case "pending_provider_review":
    default:
      // Request placed; awaiting the provider. Captured-but-odd-status falls
      // here too, so promote it if the hold was already taken.
      return { reachedIndex: paymentStatus === "captured" ? 2 : 0, outcome: "active" };
  }
}

// What the buyer's card is doing right now, in plain language. Refund lives on
// the booking status (payment_status has no "refunded" value), so it's passed in.
export interface CardState {
  key: "authorized" | "captured" | "failed" | "refunded" | "none";
  label: string;
  detail: string;
  tone: "pending" | "paid" | "failed" | "neutral";
}

export function cardStatusInfo(
  status: string | null | undefined,
  paymentStatus: string | null | undefined,
): CardState {
  if (status === "refunded" || status === "refund_pending") {
    return {
      key: "refunded",
      label: status === "refunded" ? "Refunded to your card" : "Refund pending",
      detail:
        status === "refunded"
          ? "The charge was reversed — funds are on their way back."
          : "A refund has been started and will land back on your card shortly.",
      tone: "neutral",
    };
  }
  switch (paymentStatus) {
    case "captured":
      return {
        key: "captured",
        label: "Card charged",
        detail: "The provider accepted, so your card was charged the total.",
        tone: "paid",
      };
    case "authorized":
      return {
        key: "authorized",
        label: "Card authorized — not charged",
        detail: "We placed a hold for the total. You're only charged if the provider accepts.",
        tone: "pending",
      };
    case "failed":
      return {
        key: "failed",
        label: "Card authorization failed",
        detail: "We couldn't place a hold on your card. Try requesting again with another card.",
        tone: "failed",
      };
    case "none":
    default:
      return {
        key: "none",
        label: "No active hold",
        detail: "There's no hold or charge on your card for this booking.",
        tone: "neutral",
      };
  }
}

// True when a write failed only because migration 0002 hasn't been applied yet
// (Postgres check_violation 23514). Lets the UI explain instead of showing noise.
export function isMissingStatusMigration(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === "23514" ||
    (typeof e?.message === "string" && e.message.includes("bookings_status_check"))
  );
}

// Raw bookings row.
export interface Booking {
  id: string;
  customer_id: string | null;
  provider_id: string | null; // provider's USER id
  service_id: string | null;
  date: string | null; // YYYY-MM-DD
  time_start: string | null; // HH:MM:SS
  time_end: string | null;
  status: string | null;
  amount_total: number | null;
  service_price_cents: number | null;
  platform_fee_cents: number | null;
  payment_intent_id: string | null;
  payment_status: string | null;
  decline_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Provider profile (service_providers)
// ---------------------------------------------------------------------------

export interface ProviderProfileInput {
  category: string;
  description: string;
  response_time: string;
  is_available: boolean;
  cover: string; // photos[0]
  photos: string[]; // additional gallery URLs
}

function providerUserData(profile: Profile | null, userId: string): EmbeddedUser {
  return {
    id: userId,
    name: profile?.name ?? "YardLine Provider",
    email: profile?.email ?? undefined,
    avatar: profile?.avatar ?? "",
    campus: profile?.campus ?? undefined,
    handle: profile?.handle ?? undefined,
    isProvider: true,
  };
}

function providerRow(input: ProviderProfileInput, profile: Profile | null, userId: string) {
  const photos = [input.cover, ...input.photos].filter((p) => p && p.trim().length > 0);
  return {
    user_id: userId,
    user_data: providerUserData(profile, userId),
    category: input.category,
    description: input.description.trim(),
    photos,
    is_available: input.is_available,
    response_time: input.response_time.trim() || "< 1 day",
    is_hidden: false,
    updated_at: new Date().toISOString(),
  };
}

// Create or update the signed-in user's provider profile, and flip
// profiles.is_provider so menus and gating update everywhere.
export async function saveProviderProfile(
  input: ProviderProfileInput,
  profile: Profile | null,
  userId: string,
): Promise<ServiceProvider> {
  const { data: existing } = await supabase
    .from("service_providers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const row = providerRow(input, profile, userId);
  let saved: ServiceProvider;
  if (existing?.id) {
    const { data, error } = await supabase
      .from("service_providers")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    saved = data as ServiceProvider;
  } else {
    const { data, error } = await supabase
      .from("service_providers")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    saved = data as ServiceProvider;
  }

  // Mark the account as a provider (best-effort — never block the save on it).
  await supabase
    .from("profiles")
    .update({ is_provider: true, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return saved;
}

export async function setProviderAvailability(
  providerRowId: string,
  isAvailable: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("service_providers")
    .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
    .eq("id", providerRowId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Services (the provider's menu) — keyed by the provider's USER id.
// ---------------------------------------------------------------------------

export interface ServiceInput {
  name: string;
  description: string;
  price_cents: number;
  duration: number; // minutes
  active: boolean;
}

export async function createService(input: ServiceInput, providerUserId: string): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      provider_id: providerUserId,
      name: input.name.trim(),
      description: input.description.trim(),
      price_cents: Math.max(0, Math.round(input.price_cents || 0)),
      duration: Math.max(0, Math.round(input.duration || 0)),
      active: input.active,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Service;
}

export async function updateService(serviceId: string, input: ServiceInput): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      price_cents: Math.max(0, Math.round(input.price_cents || 0)),
      duration: Math.max(0, Math.round(input.duration || 0)),
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("service_id", serviceId)
    .select()
    .single();
  if (error) throw error;
  return data as Service;
}

export async function setServiceActive(serviceId: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from("services")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("service_id", serviceId);
  if (error) throw error;
}

export async function deleteService(serviceId: string): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("service_id", serviceId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface CreateBookingInput {
  providerUserId: string; // bookings.provider_id
  service: Service;
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM
}

// Add `minutes` to "HH:MM" → "HH:MM:SS" (clamped to same day).
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  if (isNaN(h) || isNaN(m)) return `${time}:00`;
  const total = Math.min(23 * 60 + 59, h * 60 + m + Math.max(0, minutes || 0));
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

export async function createBooking(
  input: CreateBookingInput,
  customerId: string,
): Promise<Booking> {
  const price = input.service.price_cents ?? 0;
  const breakdown = priceBreakdown(price);
  const duration = input.service.duration ?? 60;
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerId,
      provider_id: input.providerUserId,
      service_id: input.service.service_id,
      date: input.date,
      time_start: `${input.timeStart}:00`,
      time_end: addMinutes(input.timeStart, duration || 60),
      status: "requested",
      payment_status: "none",
      ...breakdown,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Booking;
}

// Provider-only booking transition (confirm / decline / cancel). Booking RLS
// permits updates by the provider (provider_id = auth.uid()); the buyer cannot
// update or delete their request, so all transitions are provider- or
// server-driven. Payment capture is finalized server-side (see lib/payments.ts).
export async function setBookingStatus(
  bookingId: string,
  status: BookingStatus,
  extra?: { decline_reason?: string },
): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString(), ...(extra ?? {}) })
    .eq("id", bookingId);
  if (error) throw error;
}
