import { Hono } from "hono";
import type Stripe from "stripe";
import { stripe, stripeConfigured, deriveConnectStatus } from "../lib/stripe";
import { sbSelect, sbInsert, sbUpdate, sbDelete, supabaseConfigured } from "../lib/supabase";

const webhooksRouter = new Hono();

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Record the event id BEFORE handling. Returns false if we've already processed
// this event (duplicate delivery) — the caller then acks without re-running.
async function claimEvent(id: string, type: string): Promise<boolean> {
  try {
    await sbInsert("stripe_webhook_events", { id, type });
    return true;
  } catch (e) {
    // Primary-key conflict (409) → already processed. Any other error: log and
    // let it through so a transient insert failure doesn't drop the event.
    if (e instanceof Error && /409|duplicate|conflict/i.test(e.message)) return false;
    console.error("[webhook] claimEvent error (processing anyway):", e);
    return true;
  }
}

// --- handlers ---------------------------------------------------------------

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const md = session.metadata ?? {};
  if (md.kind !== "event" || !md.order_id) return;

  // Idempotent: skip if already paid.
  const orders = await sbSelect<{ id: string; payment_status: string | null }>(
    "yardtix_orders",
    `id=eq.${encodeURIComponent(md.order_id)}&select=id,payment_status&limit=1`,
  );
  if (!orders[0]) return;
  if (orders[0].payment_status === "paid") return;

  // Pull the receipt url from the charge when available.
  let receipt_url: string | null = null;
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (piId && stripe) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
      const charge = pi.latest_charge as Stripe.Charge | null;
      receipt_url = charge?.receipt_url ?? null;
    } catch {
      /* non-fatal */
    }
  }

  await sbUpdate("yardtix_orders", `id=eq.${md.order_id}`, {
    status: "confirmed",
    payment_status: "paid",
    payment_intent_id: piId,
    receipt_url,
    updated_at: new Date().toISOString(),
  });

  // Mint confirmed tickets from the compact items map.
  let items: Array<{ t: string; n: string; p: number; q: number }> = [];
  try {
    items = JSON.parse(md.items ?? "[]");
  } catch {
    items = [];
  }
  const rows: Record<string, unknown>[] = [];
  for (const it of items) {
    for (let i = 0; i < it.q; i++) {
      rows.push({
        order_id: md.order_id,
        event_id: md.event_id,
        holder_id: md.buyer_id,
        tier_id: it.t,
        tier_name: it.n,
        price_cents: it.p,
        status: "confirmed",
      });
    }
  }
  if (rows.length) await sbInsert("yardtix_tickets", rows);
}

async function onCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  await sbUpdate("yardtix_orders", `id=eq.${encodeURIComponent(orderId)}`, {
    status: "cancelled",
    payment_status: "cancelled",
    updated_at: new Date().toISOString(),
  });
}

async function updateBookingByPi(
  pi: Stripe.PaymentIntent,
  patch: Record<string, unknown>,
): Promise<void> {
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) return;
  await sbUpdate("bookings", `id=eq.${encodeURIComponent(bookingId)}`, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

async function onAccountUpdated(account: Stripe.Account): Promise<void> {
  const status = deriveConnectStatus(account);
  await sbUpdate("stripe_connect_accounts", `account_id=eq.${encodeURIComponent(account.id)}`, {
    status,
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    details_submitted: !!account.details_submitted,
    updated_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe — signature-verified, idempotent.
// ---------------------------------------------------------------------------
webhooksRouter.post("/stripe", async (c) => {
  if (!stripeConfigured() || !WEBHOOK_SECRET) {
    return c.json({ error: { message: "Webhooks not configured", code: "unavailable" } }, 503);
  }

  const sig = c.req.header("stripe-signature");
  const raw = await c.req.text(); // RAW body — required for signature verification
  if (!sig) return c.json({ error: { message: "Missing signature", code: "bad_request" } }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe!.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET);
  } catch (e) {
    console.error("[webhook] signature verification failed:", e instanceof Error ? e.message : e);
    return c.json({ error: { message: "Invalid signature", code: "bad_request" } }, 400);
  }

  if (!supabaseConfigured()) {
    console.error("[webhook] Supabase not configured — cannot persist", event.type);
    return c.json({ error: { message: "Storage not configured", code: "unavailable" } }, 503);
  }

  // Idempotency guard.
  if (!(await claimEvent(event.id, event.type))) {
    return c.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await onCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.amount_capturable_updated":
        // Funds are held (authorized) — awaiting provider acceptance.
        await updateBookingByPi(event.data.object as Stripe.PaymentIntent, {
          payment_status: "authorized",
        });
        break;
      case "payment_intent.succeeded":
        await updateBookingByPi(event.data.object as Stripe.PaymentIntent, {
          status: "confirmed",
          payment_status: "captured",
        });
        break;
      case "payment_intent.payment_failed":
        await updateBookingByPi(event.data.object as Stripe.PaymentIntent, {
          payment_status: "failed",
        });
        break;
      case "payment_intent.canceled":
        await updateBookingByPi(event.data.object as Stripe.PaymentIntent, {
          status: "declined",
          payment_status: "none",
        });
        break;
      case "account.updated":
        await onAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        // Unhandled event types are acked so Stripe stops retrying.
        break;
    }
  } catch (e) {
    console.error(`[webhook] handler error for ${event.type}:`, e);
    // Roll back the idempotency claim so Stripe's retry actually re-runs the
    // handler instead of being skipped as a duplicate.
    await sbDelete("stripe_webhook_events", `id=eq.${encodeURIComponent(event.id)}`).catch(() => {});
    return c.json({ error: { message: "Handler error", code: "server_error" } }, 500);
  }

  return c.json({ received: true });
});

export { webhooksRouter };
