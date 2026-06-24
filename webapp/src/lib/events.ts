import { supabase } from "./supabase";
import type { Profile, YardEvent, EmbeddedUser } from "./types";
import type { Tier, RefundPolicy, EventStatus } from "./yardtix";

// Shape produced by the create/edit form.
export interface EventDraftInput {
  title: string;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  end_time: string; // HH:MM
  location: string;
  cover: string; // URL
  photos: string[]; // additional gallery URLs
  is_free: boolean;
  max_tickets: number | null; // capacity (free RSVP cap or overall)
  ticket_price: number | null; // simple price for single-tier paid (dollars)
  tiers: Tier[];
  refund_policy: RefundPolicy;
  status: EventStatus;
  // Phase 6 — organization hosting. host_type defaults to "user".
  host_type?: "user" | "organization";
  organization_id?: string | null;
  org_name?: string | null; // used to show the org as host
  org_logo?: string | null;
}

function hostData(profile: Profile | null, userId: string): EmbeddedUser {
  return {
    id: userId,
    name: profile?.name ?? "YardLine Host",
    email: profile?.email ?? undefined,
    avatar: profile?.avatar ?? "",
    campus: profile?.campus ?? undefined,
    handle: profile?.handle ?? undefined,
    isProvider: profile?.is_provider ?? false,
  };
}

// Build the events-table row from form input. Cover is photos[0].
function toRow(input: EventDraftInput, profile: Profile | null, userId: string) {
  const photos = [input.cover, ...input.photos].filter((p) => p && p.trim().length > 0);
  const asOrg = input.host_type === "organization" && !!input.organization_id;
  // host_id stays the acting user (ownership/RLS); when hosting as an org the
  // displayed host_data is the organization's identity so pages show the org.
  const host_data = asOrg
    ? { id: input.organization_id!, name: input.org_name ?? "Organization", avatar: input.org_logo ?? "" }
    : hostData(profile, userId);
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    date: input.date,
    time: input.time,
    end_time: input.end_time || null,
    location: input.location.trim(),
    host_id: userId,
    host_data,
    host_type: asOrg ? "organization" : "user",
    organization_id: asOrg ? input.organization_id : null,
    photos,
    is_free: input.is_free,
    ticket_price: input.is_free ? 0 : input.ticket_price ?? 0,
    max_tickets: input.max_tickets,
    ticket_types: input.is_free ? [] : input.tiers,
    refund_policy: input.refund_policy,
    status: input.status,
  };
}

export async function createEvent(
  input: EventDraftInput,
  profile: Profile | null,
  userId: string,
): Promise<YardEvent> {
  const { data, error } = await supabase
    .from("events")
    .insert({ ...toRow(input, profile, userId), tickets_sold: 0, rsvp_count: 0 })
    .select()
    .single();
  if (error) throw error;
  return data as YardEvent;
}

export async function updateEvent(
  id: string,
  input: EventDraftInput,
  profile: Profile | null,
  userId: string,
): Promise<YardEvent> {
  const { data, error } = await supabase
    .from("events")
    .update(toRow(input, profile, userId))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as YardEvent;
}

export async function setEventStatus(id: string, status: EventStatus): Promise<void> {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---- read helpers ----------------------------------------------------------

export function eventTiers(event: YardEvent): Tier[] {
  const raw = event.ticket_types;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t, i): Tier => {
      const o = (t ?? {}) as Record<string, unknown>;
      const priceCents =
        typeof o.price_cents === "number"
          ? o.price_cents
          : typeof o.price === "number"
            ? Math.round((o.price as number) * (o.price < 1000 ? 100 : 1))
            : 0;
      return {
        id: (o.id as string) || `tier-${i}`,
        name: (o.name as string) || `Tier ${i + 1}`,
        description: (o.description as string) || undefined,
        price_cents: priceCents,
        capacity: typeof o.capacity === "number" ? o.capacity : (o.quantity as number) || undefined,
        max_per_buyer: typeof o.max_per_buyer === "number" ? o.max_per_buyer : undefined,
        sales_start: (o.sales_start as string) || undefined,
        sales_end: (o.sales_end as string) || undefined,
        sold: typeof o.sold === "number" ? o.sold : 0,
      };
    })
    .filter(Boolean);
}

export function priceRangeLabel(event: YardEvent): string {
  if (event.is_free) return "Free";
  const tiers = eventTiers(event);
  if (tiers.length === 0) {
    const p = Number(event.ticket_price ?? 0);
    return p > 0 ? `$${p.toFixed(p % 1 === 0 ? 0 : 2)}` : "Free";
  }
  const prices = tiers.map((t) => t.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const fmt = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

export function parseRefundPolicy(event: YardEvent): RefundPolicy {
  const raw = event.refund_policy;
  const type = raw?.type;
  if (type === "no_refunds" || type === "flexible" || type === "custom") {
    return { type, note: raw?.note || undefined };
  }
  return { type: "no_refunds" };
}
