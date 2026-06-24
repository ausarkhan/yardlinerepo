// Creator reputation aggregates (Phase 5).
//
// Computed from existing tables — no new storage. Used for trust indicators on
// provider pages, the creator dashboard, and event pages.

import { supabase } from "./supabase";
import { reviewSummary } from "./reviews";

export interface ProviderReputation {
  rating: number; // avg review score (0–10), 0 = none
  reviewCount: number;
  completedBookings: number;
}

// providerRowId = service_providers.id (reviews key); providerUserId = the
// provider's USER id (bookings.provider_id).
export async function providerReputation(
  providerRowId: string,
  providerUserId: string | null,
): Promise<ProviderReputation> {
  const [summary, completed] = await Promise.all([
    reviewSummary(providerRowId),
    providerUserId
      ? supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", providerUserId)
          .eq("status", "completed")
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if ("error" in completed && completed.error) throw completed.error;
  return {
    rating: summary.average,
    reviewCount: summary.count,
    completedBookings: (completed as { count: number | null }).count ?? 0,
  };
}

export interface HostReputation {
  rating: number; // avg event review across the host's events
  reviewCount: number;
  eventsHosted: number;
  attendeesServed: number; // used tickets across the host's events
}

export async function hostReputation(hostUserId: string): Promise<HostReputation> {
  const { data: events, error } = await supabase
    .from("events")
    .select("id")
    .eq("host_id", hostUserId);
  if (error) throw error;
  const eventIds = (events ?? []).map((e) => (e as { id: string }).id);
  if (eventIds.length === 0) {
    return { rating: 0, reviewCount: 0, eventsHosted: 0, attendeesServed: 0 };
  }

  const [{ data: reviews }, attendeesRes] = await Promise.all([
    supabase.from("reviews").select("score").in("target_id", eventIds).eq("target_type", "event"),
    supabase
      .from("yardtix_tickets")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds)
      .eq("status", "used"),
  ]);
  if (attendeesRes.error) throw attendeesRes.error;

  const scores = (reviews ?? [])
    .map((r) => (r as { score: number | null }).score)
    .filter((s): s is number => typeof s === "number");
  const rating = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    rating,
    reviewCount: scores.length,
    eventsHosted: eventIds.length,
    attendeesServed: attendeesRes.count ?? 0,
  };
}

// Single-event rating summary (for event pages).
export async function eventReputation(eventId: string) {
  return reviewSummary(eventId);
}
