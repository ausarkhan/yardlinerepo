// Reviews & ratings domain layer (Phase 5).
//
// Reuses the EXISTING `reviews` table (no migration). Convention preserved:
//   target_type = 'provider' | 'event'
//   target_id   = service_providers.id (the provider ROW id) for providers,
//                 events.id for events
//   score       = 1..10
//
// Eligibility (enforced in the UI + here):
//   provider — the reviewer has a booking with this provider where status='completed'
//   event    — the reviewer holds a yardtix_tickets row for the event with status='used'

import { supabase } from "./supabase";
import type { Review, Profile } from "./types";

export const REVIEW_MIN = 1;
export const REVIEW_MAX = 10;

export type ReviewTargetType = "provider" | "event";

export interface ReviewSummary {
  average: number; // 0 when none
  count: number;
}

export interface CreateReviewInput {
  targetType: ReviewTargetType;
  targetId: string;
  targetName?: string | null;
  targetAvatar?: string | null;
  score: number;
  message: string;
}

export async function listReviews(targetId: string, limit?: number): Promise<Review[]> {
  let q = supabase
    .from("reviews")
    .select("*")
    .eq("target_id", targetId)
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function reviewSummary(targetId: string | undefined): Promise<ReviewSummary> {
  if (!targetId) return { average: 0, count: 0 };
  const { data, error } = await supabase
    .from("reviews")
    .select("score")
    .eq("target_id", targetId);
  if (error) throw error;
  const scores = (data ?? [])
    .map((r) => (r as { score: number | null }).score)
    .filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return { average: 0, count: 0 };
  const sum = scores.reduce((a, b) => a + b, 0);
  return { average: sum / scores.length, count: scores.length };
}

// Has the caller completed a booking with this provider (bookings.provider_id =
// provider USER id)? Gate for leaving a provider review.
export async function canReviewProvider(me: string, providerUserId: string): Promise<boolean> {
  if (!me || !providerUserId) return false;
  const { count, error } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", me)
    .eq("provider_id", providerUserId)
    .eq("status", "completed");
  if (error) throw error;
  return (count ?? 0) > 0;
}

// Did the caller attend this event (a used ticket)? Gate for an event review.
export async function canReviewEvent(me: string, eventId: string): Promise<boolean> {
  if (!me || !eventId) return false;
  const { count, error } = await supabase
    .from("yardtix_tickets")
    .select("id", { count: "exact", head: true })
    .eq("holder_id", me)
    .eq("event_id", eventId)
    .eq("status", "used");
  if (error) throw error;
  return (count ?? 0) > 0;
}

// Has the caller already reviewed this target? (Used to switch the CTA to "edit"
// messaging — we still allow a fresh review row.)
export async function existingReview(me: string, targetId: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("reviewer_id", me)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Review) ?? null;
}

export async function createReview(input: CreateReviewInput, reviewer: Profile): Promise<Review> {
  const score = Math.max(REVIEW_MIN, Math.min(REVIEW_MAX, Math.round(input.score)));
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      reviewer_id: reviewer.id,
      reviewer_name: reviewer.name,
      reviewer_handle: reviewer.handle,
      reviewer_avatar: reviewer.avatar,
      target_type: input.targetType,
      target_id: input.targetId,
      target_name: input.targetName ?? null,
      target_avatar: input.targetAvatar ?? null,
      score,
      message: input.message.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Review;
}
