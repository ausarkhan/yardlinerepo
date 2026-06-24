import { Hono } from "hono";
import { getUserId, sbSelect, sbUpdate, supabaseConfigured } from "../lib/supabase";
import {
  CheckinScanRequest,
  type CheckinScanResponse,
  type CheckinTicket,
  type CheckinSummaryResponse,
} from "../types";

const checkinRouter = new Hono();

// ---------------------------------------------------------------------------
// Phase 5 — Ticket check-in (host-facing).
//
// Hosts scan a ticket's qr_token or type its ticket_number; the service-role
// backend verifies the ticket is for one of the caller's events, is admissible,
// and isn't already used, then stamps status='used' + used_at. RLS only lets a
// holder update their own ticket, so this MUST run server-side.
// ---------------------------------------------------------------------------

// Admissible ticket states: a real, paid/issued ticket. Anything else
// (created / refunded / cancelled) is not a valid admission.
const ADMISSIBLE = new Set(["confirmed", "used"]);

interface TicketRow {
  id: string;
  ticket_number: string;
  event_id: string;
  holder_id: string;
  tier_name: string | null;
  status: string;
  used_at: string | null;
}

interface EventRow {
  id: string;
  host_id: string;
  title: string | null;
}

// Best-effort holder display name. Never throws — check-in must succeed even if
// the profile lookup fails. profiles exposes name / handle / campus.
async function holderName(holderId: string): Promise<string | null> {
  try {
    const rows = await sbSelect<{ name: string | null; handle: string | null }>(
      "profiles",
      `id=eq.${encodeURIComponent(holderId)}&select=name,handle&limit=1`,
    );
    const p = rows[0];
    return p?.name || p?.handle || null;
  } catch {
    return null;
  }
}

// Batched best-effort holder names for the summary roster.
async function holderNames(holderIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const ids = [...new Set(holderIds)];
  if (ids.length === 0) return out;
  try {
    const list = ids.map((id) => `"${id}"`).join(",");
    const rows = await sbSelect<{ id: string; name: string | null; handle: string | null }>(
      "profiles",
      `id=in.(${encodeURIComponent(list)})&select=id,name,handle`,
    );
    for (const r of rows) out.set(r.id, r.name || r.handle || null);
  } catch {
    /* leave names null */
  }
  return out;
}

function toCheckinTicket(
  t: TicketRow,
  eventTitle: string | null,
  name: string | null,
): CheckinTicket {
  return {
    id: t.id,
    ticket_number: t.ticket_number,
    event_id: t.event_id,
    event_title: eventTitle,
    holder_id: t.holder_id,
    holder_name: name,
    tier_name: t.tier_name,
    status: t.status,
    used_at: t.used_at,
  };
}

// ---------------------------------------------------------------------------
// POST /api/checkin/scan — verify + admit a single ticket.
//
// All domain outcomes (not_found / wrong_event / not_authorized /
// invalid_status / already_used / ok) return HTTP 200 with the envelope so the
// scanner UI can render a friendly result. Only auth / config / parse failures
// use 4xx/5xx.
// ---------------------------------------------------------------------------
checkinRouter.post("/scan", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);

  if (!supabaseConfigured()) {
    return c.json({ error: { message: "Not configured", code: "unavailable" } }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = CheckinScanRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid scan request", code: "bad_request" } }, 400);
  }
  const { qr_token, ticket_number, event_id } = parsed.data;

  const result = (
    code: CheckinScanResponse["result"],
    ticket: CheckinTicket | null,
    message?: string,
  ) => c.json({ data: { result: code, ticket, message: message ?? null } satisfies CheckinScanResponse });

  try {
    // Look up the ticket by qr_token (preferred) or ticket_number.
    const filter = qr_token
      ? `qr_token=eq.${encodeURIComponent(qr_token)}`
      : `ticket_number=eq.${encodeURIComponent(ticket_number!)}`;
    const tickets = await sbSelect<TicketRow>(
      "yardtix_tickets",
      `${filter}&select=id,ticket_number,event_id,holder_id,tier_name,status,used_at&limit=1`,
    );
    const ticket = tickets[0];
    if (!ticket) {
      return result("not_found", null, "No ticket matches that code.");
    }

    // Load the ticket's event to authorize the host and supply a title.
    const events = await sbSelect<EventRow>(
      "events",
      `id=eq.${encodeURIComponent(ticket.event_id)}&select=id,host_id,title&limit=1`,
    );
    const event = events[0];
    if (!event || event.host_id !== userId) {
      return result("not_authorized", null, "This ticket isn't for one of your events.");
    }

    const name = await holderName(ticket.holder_id);

    // Optional guard: the host is checking in for a specific event.
    if (event_id && ticket.event_id !== event_id) {
      return result(
        "wrong_event",
        toCheckinTicket(ticket, event.title, name),
        "This ticket is for a different event.",
      );
    }

    // Not a real, admissible ticket (refunded / cancelled / created).
    if (!ADMISSIBLE.has(ticket.status)) {
      return result(
        "invalid_status",
        toCheckinTicket(ticket, event.title, name),
        `Ticket is ${ticket.status} — not admissible.`,
      );
    }

    // Already checked in.
    if (ticket.status === "used" || ticket.used_at) {
      return result(
        "already_used",
        toCheckinTicket(ticket, event.title, name),
        "This ticket was already checked in.",
      );
    }

    // Admit: stamp used.
    const usedAt = new Date().toISOString();
    await sbUpdate("yardtix_tickets", `id=eq.${ticket.id}`, {
      status: "used",
      used_at: usedAt,
      updated_at: usedAt,
    });

    return result(
      "ok",
      toCheckinTicket({ ...ticket, status: "used", used_at: usedAt }, event.title, name),
      "Checked in.",
    );
  } catch (e) {
    return c.json(
      { error: { message: e instanceof Error ? e.message : "Scan failed", code: "error" } },
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/checkin/event/:eventId/summary — host roster + live counts.
// ---------------------------------------------------------------------------
checkinRouter.get("/event/:eventId/summary", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);

  if (!supabaseConfigured()) {
    return c.json({ error: { message: "Not configured", code: "unavailable" } }, 503);
  }

  const eventId = c.req.param("eventId");

  try {
    const events = await sbSelect<EventRow>(
      "events",
      `id=eq.${encodeURIComponent(eventId)}&select=id,host_id,title&limit=1`,
    );
    const event = events[0];
    if (!event) {
      return c.json({ error: { message: "Event not found", code: "not_found" } }, 404);
    }
    if (event.host_id !== userId) {
      return c.json({ error: { message: "Not your event", code: "forbidden" } }, 403);
    }

    // Admissible tickets (confirmed + used) for this event.
    const rows = await sbSelect<TicketRow>(
      "yardtix_tickets",
      `event_id=eq.${encodeURIComponent(eventId)}&status=in.(confirmed,used)` +
        `&select=id,ticket_number,event_id,holder_id,tier_name,status,used_at&order=created_at.asc`,
    );

    const names = await holderNames(rows.map((r) => r.holder_id));
    const tickets = rows.map((r) => toCheckinTicket(r, event.title, names.get(r.holder_id) ?? null));

    const total = rows.length;
    const checked_in = rows.filter((r) => r.status === "used").length;

    const resp: CheckinSummaryResponse = {
      event_id: eventId,
      total,
      checked_in,
      remaining: total - checked_in,
      tickets,
    };
    return c.json({ data: resp });
  } catch (e) {
    return c.json(
      { error: { message: e instanceof Error ? e.message : "Summary failed", code: "error" } },
      500,
    );
  }
});

export { checkinRouter };
