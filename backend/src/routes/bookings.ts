import { Hono } from "hono";
import type Stripe from "stripe";
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

function capturedResponse(id: string, message: string | null = null): BookingActionResponse {
  return {
    booking_id: id,
    status: "confirmed",
    payment_status: "captured",
    message,
  };
}

async function markCaptured(id: string): Promise<void> {
  await sbUpdate("bookings", `id=eq.${encodeURIComponent(id)}`, {
    status: "confirmed",
    payment_status: "captured",
    updated_at: new Date().toISOString(),
  });
}

function isAlreadyCapturedStripeError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? "");
  return /already.*captur|already.*succeed|status of succeeded|not capturable|cannot.*capture.*succeeded|could not be captured.*succeeded/i.test(
    message,
  );
}

function stripeIntentIsCaptured(pi: Stripe.PaymentIntent): boolean {
  return pi.status === "succeeded" || pi.amount_received > 0;
}

function stripeIntentIsCapturable(pi: Stripe.PaymentIntent): boolean {
  return pi.status === "requires_capture" && pi.amount_capturable > 0;
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : String(e || fallback);
}

function logAcceptError(id: string, paymentIntentId: string | null, stage: string, e: unknown): void {
  console.error("[bookings.accept] failed", {
    booking_id: id,
    payment_intent_id: paymentIntentId,
    stage,
    message: errorMessage(e, "Accept failed"),
  });
}

// ---------------------------------------------------------------------------
// POST /api/bookings/:id/accept — capture the authorized payment, confirm.
// ---------------------------------------------------------------------------
bookingsRouter.post("/:id/accept", async (c) => {
  const id = c.req.param("id");
  try {
    const userId = await getUserId(c.req.header("Authorization"));
    if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);
    if (!stripeConfigured() || !supabaseConfigured()) {
      return c.json({ error: { message: "Payments are not configured", code: "unavailable" } }, 503);
    }

    const { booking, status, message } = await loadProviderBooking(id, userId);
    if (!booking) return c.json({ error: { message, code: "error" } }, (status as 403) ?? 400);

    // Idempotent: already captured locally. Keep status converged too in case a
    // previous write captured payment_status but left status stale.
    if (booking.payment_status === "captured") {
      await markCaptured(id);
      return c.json({ data: capturedResponse(id, "Already captured.") });
    }

    if (!booking.payment_intent_id) {
      return c.json({ error: { message: "No authorized payment to capture", code: "bad_request" } }, 400);
    }

    const paymentIntent = await stripe!.paymentIntents.retrieve(booking.payment_intent_id);
    if (stripeIntentIsCaptured(paymentIntent)) {
      await markCaptured(id);
      return c.json({ data: capturedResponse(id, "Already captured.") });
    }

    if (!stripeIntentIsCapturable(paymentIntent)) {
      return c.json(
        {
          error: {
            message: `PaymentIntent is not capturable in status ${paymentIntent.status}`,
            code: "not_capturable",
          },
        },
        409,
      );
    }

    try {
      const captured = await stripe!.paymentIntents.capture(booking.payment_intent_id);
      // Optimistic write for immediacy; the payment_intent.succeeded webhook is
      // idempotent and will converge to the same state.
      if (stripeIntentIsCaptured(captured)) {
        await markCaptured(id);
        return c.json({ data: capturedResponse(id) });
      }

      return c.json(
        {
          error: {
            message: `PaymentIntent capture did not succeed; status is ${captured.status}`,
            code: "capture_incomplete",
          },
        },
        409,
      );
    } catch (e) {
      // A repeated accept can race the webhook/DB write: Stripe may already have
      // captured the PaymentIntent while the booking row still reads authorized.
      // Converge local state and return an idempotent success instead of trying a
      // second capture or surfacing a safe duplicate as a failure.
      if (isAlreadyCapturedStripeError(e)) {
        const latest = await stripe!.paymentIntents.retrieve(booking.payment_intent_id);
        if (stripeIntentIsCaptured(latest)) {
          await markCaptured(id);
          return c.json({ data: capturedResponse(id, "Already captured.") });
        }
      }
      logAcceptError(id, booking.payment_intent_id, "capture", e);
      return c.json({ error: { message: errorMessage(e, "Capture failed"), code: "stripe_error" } }, 400);
    }
  } catch (e) {
    logAcceptError(id, null, "route", e);
    return c.json({ error: { message: errorMessage(e, "Accept failed"), code: "accept_error" } }, 500);
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
