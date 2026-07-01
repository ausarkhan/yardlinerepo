// Phase 4 order/ticket read layer.
//
// The richer `yardtix_orders` / `yardtix_tickets` tables are minted by the
// Stripe webhook and land in Supabase via a later migration. Until that
// migration is applied the tables DO NOT EXIST, so every read here is wrapped
// to degrade gracefully (treat as empty / revenue 0) and NEVER crash the page.

import { supabase } from "./supabase";

// Raw yardtix_orders row (only the columns the web app reads).
export interface OrderRow {
  id: string;
  order_number: string | null;
  event_id: string | null;
  buyer_id: string | null;
  host_id: string | null;
  subtotal_cents: number | null;
  fee_cents: number | null;
  total_cents: number | null;
  payment_status: string | null;
  ticket_count: number | null;
  receipt_url: string | null;
  created_at: string | null;
}

// Raw yardtix_tickets row (only the columns the web app reads).
export interface TicketRow {
  id: string;
  order_id: string | null;
  event_id: string | null;
  holder_id: string | null;
  ticket_number: string | null;
  tier_name: string | null;
  status: string | null;
  qr_token: string | null;
  created_at: string | null;
}

// True when a supabase error means the table just isn't there yet (migration
// not applied). Postgres reports 42P01 (undefined_table); PostgREST surfaces
// PGRST205 (could not find table) / a 404. Any of these → degrade to empty.
export function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string; status?: number } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

// A supabase query builder is "thenable" — awaiting it resolves to { data, error }.
type SafeQuery = PromiseLike<{ data: unknown; error: unknown }>;

// Generic safe read: returns [] when the table is missing or any error occurs,
// so a not-yet-migrated yardtix_* table degrades to empty rather than crashing.
async function safeSelect<T>(run: () => SafeQuery): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      // Whether it's a missing table or any other error, degrade gracefully.
      return [];
    }
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

// ---- Orders ---------------------------------------------------------------

export async function fetchOrderById(orderId: string): Promise<OrderRow | null> {
  const rows = await safeSelect<OrderRow>(() =>
    supabase.from("yardtix_orders").select("*").eq("id", orderId).limit(1),
  );
  return rows[0] ?? null;
}

export async function fetchOrdersForHost(hostId: string): Promise<OrderRow[]> {
  return safeSelect<OrderRow>(() =>
    supabase
      .from("yardtix_orders")
      .select("*")
      .eq("host_id", hostId)
      .order("created_at", { ascending: false }),
  );
}

export async function fetchOrdersForEvent(eventId: string): Promise<OrderRow[]> {
  return safeSelect<OrderRow>(() =>
    supabase
      .from("yardtix_orders")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  );
}

// ---- Tickets --------------------------------------------------------------

export async function fetchTicketsForOrder(orderId: string): Promise<TicketRow[]> {
  return safeSelect<TicketRow>(() =>
    supabase
      .from("yardtix_tickets")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  );
}

// Confirmed tickets the signed-in user holds (their paid tickets).
export async function fetchTicketsForHolder(holderId: string): Promise<TicketRow[]> {
  return safeSelect<TicketRow>(() =>
    supabase
      .from("yardtix_tickets")
      .select("*")
      .eq("holder_id", holderId)
      .order("created_at", { ascending: false }),
  );
}

// Confirmed tickets for an event, readable by the host through RLS.
export async function fetchTicketsForEvent(eventId: string): Promise<TicketRow[]> {
  return safeSelect<TicketRow>(() =>
    supabase
      .from("yardtix_tickets")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  );
}

// Count of minted tickets per event id (graceful → {} when absent).
export async function fetchTicketCountsByEvent(
  eventIds: string[],
): Promise<Record<string, number>> {
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const rows = await safeSelect<{ event_id: string | null }>(() =>
    supabase.from("yardtix_tickets").select("event_id").in("event_id", ids),
  );
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (!r.event_id) continue;
    counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
  }
  return counts;
}
