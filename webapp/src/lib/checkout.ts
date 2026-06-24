// Phase 4 checkout data layer (frontend).
//
// Talks to the Stripe-backed backend, authenticated with the user's Supabase
// access token (same pattern as lib/stripeConnect.ts). Response shapes mirror
// backend/src/types.ts — the single source of truth.

import { api } from "./api";
import { supabase } from "./supabase";
import { appOrigin } from "./stripeClient";

export interface EventCheckoutResponse {
  url: string | null;
  session_id: string | null;
  order_id: string | null;
  message?: string | null;
}

export interface BookingIntentResponse {
  booking_id: string | null;
  client_secret: string | null;
  service_price_cents: number;
  platform_fee_cents: number;
  amount_total: number;
  test_mode: boolean;
  message?: string | null;
}

export interface BookingActionResponse {
  booking_id: string;
  status: string;
  payment_status: string;
  message?: string | null;
}

export interface SessionStatusResponse {
  order_id: string | null;
  payment_status: string;
  ticket_count: number;
  receipt_url: string | null;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Create a Stripe Checkout Session for event tickets → returns a hosted URL.
export async function createEventSession(
  eventId: string,
  items: Array<{ tier_id: string; quantity: number }>,
): Promise<EventCheckoutResponse> {
  return api.post<EventCheckoutResponse>(
    "/api/checkout/event-session",
    { event_id: eventId, items, origin: appOrigin() },
    { headers: await authHeader() },
  );
}

// Create a booking + manual-capture PaymentIntent → returns a client secret.
export async function createBookingIntent(input: {
  service_id: string;
  provider_user_id: string;
  date: string;
  time_start: string;
}): Promise<BookingIntentResponse> {
  return api.post<BookingIntentResponse>("/api/checkout/booking-intent", input, {
    headers: await authHeader(),
  });
}

export async function getSessionStatus(orderId: string): Promise<SessionStatusResponse> {
  return api.get<SessionStatusResponse>(`/api/checkout/session/${orderId}/status`, {
    headers: await authHeader(),
  });
}

export async function acceptBooking(bookingId: string): Promise<BookingActionResponse> {
  return api.post<BookingActionResponse>(`/api/bookings/${bookingId}/accept`, undefined, {
    headers: await authHeader(),
  });
}

export async function declineBooking(
  bookingId: string,
  reason?: string,
): Promise<BookingActionResponse> {
  return api.post<BookingActionResponse>(
    `/api/bookings/${bookingId}/decline`,
    { reason },
    { headers: await authHeader() },
  );
}

// Customer cancels their own pending request → server RELEASES the authorization
// (hold returned). Only allowed before the provider accepts.
export async function cancelBooking(bookingId: string): Promise<BookingActionResponse> {
  return api.post<BookingActionResponse>(`/api/bookings/${bookingId}/cancel`, undefined, {
    headers: await authHeader(),
  });
}
