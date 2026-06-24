import { Hono } from "hono";
import { stripe, stripeConfigured } from "../lib/stripe";
import { getUserId, sbSelect, sbUpdate, supabaseConfigured } from "../lib/supabase";
import type { BookingActionResponse } from "../types";

const bookingsRouter = new Hono();

interface BookingRow {
  id: string;
  provider_id: string;
  customer_id: string;
  payment_intent_id: string | null;
  payment_status: string | null;
  status: string | null;
}

// Load a booking and assert the caller is the provider (the only one who may
// accept/decline). Returns null + an HTTP status code on failure.
async function loadProviderBooking(
  id: string,
  userId: string,
): Promise<{ booking?: BookingRow; status?: number; message?: string }> {
  const rows = await sbSelect<BookingRow>(
    "bookings",
    `id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  const booking = rows[0];
  if (!booking) return { status: 404, message: "Booking not found" };
  if (booking.provider_id !== userId) return { status: 403, message: "Not your booking" };
  return { booking };
}

// Load a booking and assert the caller is the customer (the only one who may
// cancel their own pending request). Mirror of loadProviderBooking.
async function loadCustomerBooking(
  id: string,
  userId: string,
): Promise<{ booking?: BookingRow; status?: number; message?: string }> {
  const rows = await sbSelect<BookingRow>(
    "bookings",
    `id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  const booking = rows[0];
  if (!booking) return { status: 404, message: "Booking not found" };
  if (booking.customer_id !== userId) return { status: 403, message: "Not your booking" };
  return { booking };
}

// A booking the customer may still cancel: the provider hasn't accepted yet, so
// the card is at most authorized (never captured).
const CUSTOMER_CANCELABLE = new Set([
  "requested",
  "pending",
  "pending_provider_review",
]);

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/accept — capture the authorized payment, confirm.
// ---------------------------------------------------------------------------
bookingsRouter.post("/:id/accept", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);
  if (!stripeConfigured() || !supabaseConfigured()) {
    return c.json({ error: { message: "Payments are not configured", code: "unavailable" } }, 503);
  }

  const id = c.req.param("id");
  const { booking, status, message } = await loadProviderBooking(id, userId);
  if (!booking) return c.json({ error: { message, code: "error" } }, (status as 403) ?? 400);

  // Idempotent: already captured.
  if (booking.payment_status === "captured") {
    const resp: BookingActionResponse = {
      booking_id: id,
      status: "confirmed",
      payment_status: "captured",
      message: "Already captured.",
    };
    return c.json({ data: resp });
  }

  if (!booking.payment_intent_id) {
    return c.json({ error: { message: "No authorized payment to capture", code: "bad_request" } }, 400);
  }

  try {
    await stripe!.paymentIntents.capture(booking.payment_intent_id);
    // Optimistic write for immediacy; the payment_intent.succeeded webhook is
    // idempotent and will converge to the same state.
    await sbUpdate("bookings", `id=eq.${id}`, {
      status: "confirmed",
      payment_status: "captured",
      updated_at: new Date().toISOString(),
    });
    const resp: BookingActionResponse = {
      booking_id: id,
      status: "confirmed",
      payment_status: "captured",
      message: null,
    };
    return c.json({ data: resp });
  } catch (e) {
    return c.json(
      { error: { message: e instanceof Error ? e.message : "Capture failed", code: "stripe_error" } },
      400,
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/decline — release the authorization, decline.
// ---------------------------------------------------------------------------
bookingsRouter.post("/:id/decline", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);
  if (!stripeConfigured() || !supabaseConfigured()) {
    return c.json({ error: { message: "Payments are not configured", code: "unavailable" } }, 503);
  }

  const id = c.req.param("id");
  const bodyJson = (await c.req.json().catch(() => ({}))) as { reason?: string };
  const { booking, status, message } = await loadProviderBooking(id, userId);
  if (!booking) return c.json({ error: { message, code: "error" } }, (status as 403) ?? 400);

  try {
    // Release the held funds if there's an authorization that isn't captured.
    if (booking.payment_intent_id && booking.payment_status !== "captured") {
      await stripe!.paymentIntents.cancel(booking.payment_intent_id).catch(() => {
        /* already cancelled / not cancelable — fall through to status write */
      });
    }
    await sbUpdate("bookings", `id=eq.${id}`, {
      status: "declined",
      payment_status: "none",
      decline_reason: bodyJson.reason ?? null,
      updated_at: new Date().toISOString(),
    });
    const resp: BookingActionResponse = {
      booking_id: id,
      status: "declined",
      payment_status: "none",
      message: null,
    };
    return c.json({ data: resp });
  } catch (e) {
    return c.json(
      { error: { message: e instanceof Error ? e.message : "Decline failed", code: "stripe_error" } },
      400,
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/cancel — customer cancels their own pending request.
//
// Allowed only while the provider hasn't accepted (status still pending and the
// payment is at most authorized). Releases the held authorization so the card is
// never charged. Booking RLS blocks buyer writes, so this MUST run server-side
// with the service role.
// ---------------------------------------------------------------------------
bookingsRouter.post("/:id/cancel", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);
  if (!supabaseConfigured()) {
    return c.json({ error: { message: "Bookings are not configured", code: "unavailable" } }, 503);
  }

  const id = c.req.param("id");
  const { booking, status, message } = await loadCustomerBooking(id, userId);
  if (!booking) return c.json({ error: { message, code: "error" } }, (status as 403) ?? 400);

  // Idempotent: already cancelled.
  if (booking.status === "cancelled") {
    const resp: BookingActionResponse = {
      booking_id: id,
      status: "cancelled",
      payment_status: "none",
      message: "Already cancelled.",
    };
    return c.json({ data: resp });
  }

  // Once the provider has accepted (captured) or the request is otherwise
  // resolved, the customer can't self-cancel — that would need a refund.
  if (!CUSTOMER_CANCELABLE.has(booking.status ?? "") || booking.payment_status === "captured") {
    return c.json(
      {
        error: {
          message: "This booking can no longer be cancelled. Contact the provider for a refund.",
          code: "not_cancelable",
        },
      },
      409,
    );
  }

  try {
    // Release the authorization hold if Stripe is configured and one exists.
    if (stripeConfigured() && booking.payment_intent_id && booking.payment_status !== "captured") {
      await stripe!.paymentIntents.cancel(booking.payment_intent_id).catch(() => {
        /* already released / not cancelable — fall through to the status write */
      });
    }
    await sbUpdate("bookings", `id=eq.${id}`, {
      status: "cancelled",
      payment_status: "none",
      updated_at: new Date().toISOString(),
    });
    const resp: BookingActionResponse = {
      booking_id: id,
      status: "cancelled",
      payment_status: "none",
      message: null,
    };
    return c.json({ data: resp });
  } catch (e) {
    return c.json(
      { error: { message: e instanceof Error ? e.message : "Cancel failed", code: "cancel_error" } },
      400,
    );
  }
});

export { bookingsRouter };
