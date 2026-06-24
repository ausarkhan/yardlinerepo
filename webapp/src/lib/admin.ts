// Admin / moderation domain layer (Phase 5).
//
// All admin reads/writes run through the webapp under RLS — the policies added in
// migration 0004 only permit them when the caller's profiles.role = 'admin'
// (is_admin()). Every moderation action writes an immutable moderation_actions
// audit row with a required reason. Removals are SOFT (status / is_hidden flags);
// nothing is hard-deleted.

import { supabase } from "./supabase";
import type { Profile, YardEvent, ServiceProvider, Report } from "./types";

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin";
}

// ---------------------------------------------------------------------------
// Platform metrics (simple counts — no advanced analytics this phase)
// ---------------------------------------------------------------------------
export interface PlatformMetrics {
  users: number;
  events: number;
  providers: number;
  bookings: number;
  ticketsSold: number;
}

async function countOf(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function platformMetrics(): Promise<PlatformMetrics> {
  const [users, events, providers, bookings, ticketsRes] = await Promise.all([
    countOf("profiles"),
    countOf("events"),
    countOf("service_providers"),
    countOf("bookings"),
    // "Sold" = issued tickets that aren't refunded/cancelled.
    supabase
      .from("yardtix_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["confirmed", "used"]),
  ]);
  if (ticketsRes.error) throw ticketsRes.error;
  return { users, events, providers, bookings, ticketsSold: ticketsRes.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Listings (paginated)
// ---------------------------------------------------------------------------
const PAGE = 25;

export async function adminListUsers(page = 0, search = ""): Promise<Profile[]> {
  let q = supabase
    .from("profiles")
    .select("*")
    .order("joined_date", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`name.ilike.${s},handle.ilike.${s},email.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function adminListEvents(page = 0): Promise<YardEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (error) throw error;
  return (data ?? []) as YardEvent[];
}

export interface AdminProviderRow {
  provider: ServiceProvider;
  rating: number;
  reviewCount: number;
  bookingVolume: number;
}

export async function adminListProviders(page = 0): Promise<AdminProviderRow[]> {
  const { data, error } = await supabase
    .from("service_providers")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (error) throw error;
  const providers = (data ?? []) as ServiceProvider[];
  if (providers.length === 0) return [];

  const rowIds = providers.map((p) => p.id);
  const userIds = providers.map((p) => p.user_id ?? "").filter(Boolean);

  // Ratings keyed by provider ROW id; booking volume keyed by provider USER id.
  const [{ data: reviews }, { data: bookings }] = await Promise.all([
    supabase.from("reviews").select("target_id, score").in("target_id", rowIds),
    supabase.from("bookings").select("provider_id").in("provider_id", userIds),
  ]);

  const ratingAgg: Record<string, { sum: number; n: number }> = {};
  (reviews ?? []).forEach((r) => {
    const row = r as { target_id: string; score: number | null };
    if (typeof row.score !== "number") return;
    const a = (ratingAgg[row.target_id] ??= { sum: 0, n: 0 });
    a.sum += row.score;
    a.n += 1;
  });
  const volume: Record<string, number> = {};
  (bookings ?? []).forEach((b) => {
    const id = (b as { provider_id: string | null }).provider_id ?? "";
    volume[id] = (volume[id] ?? 0) + 1;
  });

  return providers.map((p) => {
    const agg = ratingAgg[p.id];
    return {
      provider: p,
      rating: agg && agg.n > 0 ? agg.sum / agg.n : 0,
      reviewCount: agg?.n ?? 0,
      bookingVolume: p.user_id ? volume[p.user_id] ?? 0 : 0,
    };
  });
}

export async function adminListReports(status?: Report["status"]): Promise<Report[]> {
  let q = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Report[];
}

// ---------------------------------------------------------------------------
// Moderation actions — each logs an audit row + applies a soft change.
// ---------------------------------------------------------------------------
export type ModerationActionType =
  | "suspend_user"
  | "reinstate_user"
  | "hide_event"
  | "restore_event"
  | "disable_provider"
  | "restore_provider"
  | "dismiss_report"
  | "resolve_report";

async function logModeration(
  adminId: string,
  action: ModerationActionType,
  targetType: string,
  targetId: string,
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("moderation_actions").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason: reason.trim() || null,
    metadata: metadata ?? null,
  });
  if (error) throw error;
}

// Best-effort recipient notification for an admin action (RLS allows admins to
// insert notifications for any user). Never blocks the action itself.
async function notifyUser(userId: string, title: string, body: string): Promise<void> {
  await supabase
    .from("notifications")
    .insert({ user_id: userId, type: "admin_action", title, body })
    .then(undefined, () => undefined);
}

export async function suspendUser(adminId: string, userId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "suspended", suspended_at: new Date().toISOString(), suspension_reason: reason })
    .eq("id", userId);
  if (error) throw error;
  await logModeration(adminId, "suspend_user", "user", userId, reason);
  await notifyUser(userId, "Account suspended", reason || "Your account has been suspended.");
}

export async function reinstateUser(adminId: string, userId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ status: "active", suspended_at: null, suspension_reason: null })
    .eq("id", userId);
  if (error) throw error;
  await logModeration(adminId, "reinstate_user", "user", userId, reason);
  await notifyUser(userId, "Account reinstated", "Your account is active again.");
}

export async function setEventHidden(
  adminId: string,
  eventId: string,
  hidden: boolean,
  reason: string,
): Promise<void> {
  const { error } = await supabase.from("events").update({ is_hidden: hidden }).eq("id", eventId);
  if (error) throw error;
  await logModeration(adminId, hidden ? "hide_event" : "restore_event", "event", eventId, reason);
}

export async function setProviderHidden(
  adminId: string,
  providerRowId: string,
  hidden: boolean,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("service_providers")
    .update({ is_hidden: hidden })
    .eq("id", providerRowId);
  if (error) throw error;
  await logModeration(
    adminId,
    hidden ? "disable_provider" : "restore_provider",
    "provider",
    providerRowId,
    reason,
  );
}

// Resolve a report. `actioned` = moderation was taken; `dismissed` = no action.
export async function resolveReport(
  adminId: string,
  report: Report,
  outcome: "actioned" | "dismissed",
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("reports")
    .update({
      status: outcome,
      resolution: reason.trim() || null,
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", report.id);
  if (error) throw error;
  await logModeration(
    adminId,
    outcome === "actioned" ? "resolve_report" : "dismiss_report",
    "report",
    report.id,
    reason,
    { target_type: report.target_type, target_id: report.target_id, category: report.category },
  );
}

export async function listModerationHistory(): Promise<import("./types").ModerationAction[]> {
  const { data, error } = await supabase
    .from("moderation_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as import("./types").ModerationAction[];
}
