import { Hono } from "hono";
import { stripe, stripeConfigured, isTestMode } from "../lib/stripe";
import { getUserId, sbSelect, sbInsert, sbUpdate, sbDelete, supabaseConfigured } from "../lib/supabase";
import { lineFees, singleBreakdown } from "../lib/fees";
import {
  EventCheckoutRequest,
  BookingIntentRequest,
  type EventCheckoutResponse,
  type BookingIntentResponse,
  type SessionStatusResponse,
} from "../types";

const checkoutRouter = new Hono();

// "Payments aren't ready" soft-fail payload — the webapp hard-disables paid
// flows and shows `message` instead of throwing.
function notReady(message: string): EventCheckoutResponse {
  return { url: null, session_id: null, order_id: null, message };
}

function normalizeTime(value: string): string {
  const [hours = "00", minutes = "00"] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
}

// Resolve a creator's ACTIVE Connect account (charges enabled). Returns null
// when the creator hasn't finished onboarding — paid selling stays blocked.
async function activeConnectAccount(userId: string): Promise<string | null> {
  const rows = await sbSelect<{
    account_id: string | null;
    charges_enabled: boolean | null;
    payouts_enabled: boolean | null;
    status: string | null;
  }>("stripe_connect_accounts", `user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
  const row = rows[0];
  if (row?.account_id && row.charges_enabled && row.payouts_enabled && row.status === "active") {
    return row.account_id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/checkout/event-session — instant ticket purchase (Stripe Checkout).
// ---------------------------------------------------------------------------
checkoutRouter.post("/event-session", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = EventCheckoutRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid checkout request", code: "bad_request" } }, 400);
  }
  const { event_id, items, origin } = parsed.data;

  if (!stripeConfigured() || !supabaseConfigured()) {
    return c.json({ data: notReady("Payments are not configured yet.") });
  }

  try {
    // Load the event + its tiers (server-side pricing — never trust the client).
    const events = await sbSelect<{
      id: string;
      host_id: string;
      title: string;
      is_free: boolean | null;
      ticket_types: Array<{ id: string; name: string; price_cents: number }> | null;
    }>("events", `id=eq.${encodeURIComponent(event_id)}&select=*&limit=1`);
    const event = events[0];
    if (!event) return c.json({ error: { message: "Event not found", code: "not_found" } }, 404);
    if (event.is_free) return c.json({ data: notReady("This is a free event — no payment needed.") });

    const hostAccount = await activeConnectAccount(event.host_id);
    if (!hostAccount) {
      return c.json({ data: notReady("The host hasn't activated payments yet.") });
    }

    // Match requested items to real tiers and price them.
    const tiers = event.ticket_types ?? [];
    const priced = items.map((it) => {
      const tier = tiers.find((t) => t.id === it.tier_id);
      if (!tier) throw new Error(`Unknown ticket tier: ${it.tier_id}`);
      return {
        tier_id: tier.id,
        tier_name: tier.name,
        price_cents: Math.max(0, Math.round(tier.price_cents || 0)),
        quantity: it.quantity,
      };
    });
    const fees = lineFees(priced.map((p) => ({ price_cents: p.price_cents, quantity: p.quantity })));
    const quantity = priced.reduce((s, p) => s + p.quantity, 0);
    if (quantity <= 0 || fees.total_cents <= 0) {
      return c.json({ error: { message: "Nothing to purchase", code: "bad_request" } }, 400);
    }

    // Reuse a still-open pending checkout for the same buyer/event/cart. This
    // protects against rapid repeated clicks creating duplicate sessions/orders.
    const existingOrders = await sbSelect<{
      id: string;
      checkout_session_id: string | null;
      created_at: string | null;
    }>(
      "yardtix_orders",
      [
        `event_id=eq.${encodeURIComponent(event_id)}`,
        `buyer_id=eq.${encodeURIComponent(userId)}`,
        "payment_status=eq.pending",
        `quantity=eq.${quantity}`,
        `total_cents=eq.${fees.total_cents}`,
        "select=id,checkout_session_id,created_at",
        "order=created_at.desc",
        "limit=1",
      ].join("&"),
    );
    const existingOrder = existingOrders[0];
    if (existingOrder?.checkout_session_id && stripe) {
      const ageMs = existingOrder.created_at ? Date.now() - Date.parse(existingOrder.created_at) : 0;
      if (ageMs >= 0 && ageMs < 15 * 60 * 1000) {
        const existingSession = await stripe.checkout.sessions.retrieve(existingOrder.checkout_session_id);
        if (existingSession.status === "open" && existingSession.url) {
          const resp: EventCheckoutResponse = {
            url: existingSession.url,
            session_id: existingSession.id,
            order_id: existingOrder.id,
            message: null,
          };
          return c.json({ data: resp });
        }
      }
    }

    // Create the pending order first so the webhook can finalize it by id.
    const orderRows = await sbInsert<{ id: string; order_number: string }>(
      "yardtix_orders",
      {
        event_id,
        buyer_id: userId,
        status: "pending",
        payment_status: "pending",
        quantity,
        subtotal_cents: fees.subtotal_cents,
        platform_fee_cents: fees.fee_cents,
        total_cents: fees.total_cents,
        currency: "usd",
      },
      { returning: true },
    );
    const order = orderRows[0];
    if (!order) throw new Error("Could not create order");

    // Line items: each tier at face value + one summed platform-fee line.
    const line_items = [
      ...priced.map((p) => ({
        price_data: {
          currency: "usd",
          product_data: { name: `${event.title} — ${p.tier_name}` },
          unit_amount: p.price_cents,
        },
        quantity: p.quantity,
      })),
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Platform fee" },
          unit_amount: fees.fee_cents,
        },
        quantity: 1,
      },
    ];

    const session = await stripe!.checkout.sessions.create({
      mode: "payment",
      line_items,
      client_reference_id: order.id,
      success_url: `${origin}/receipt?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/event/${event_id}`,
      payment_intent_data: {
        application_fee_amount: fees.fee_cents,
        transfer_data: { destination: hostAccount },
        metadata: { kind: "event", order_id: order.id, event_id, buyer_id: userId },
      },
      metadata: {
        kind: "event",
        order_id: order.id,
        event_id,
        buyer_id: userId,
        // Compact items map for the webhook to mint tickets from.
        items: JSON.stringify(
          priced.map((p) => ({ t: p.tier_id, n: p.tier_name, p: p.price_cents, q: p.quantity })),
        ),
      },
    });

    await sbUpdate("yardtix_orders", `id=eq.${order.id}`, {
      checkout_session_id: session.id,
      payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      updated_at: new Date().toISOString(),
    });

    const resp: EventCheckoutResponse = {
      url: session.url ?? null,
      session_id: session.id,
      order_id: order.id,
      message: null,
    };
    return c.json({ data: resp });
  } catch (e) {
    const message =
      e instanceof Error
        ? `${e.message}${/connect|account/i.test(e.message) ? " (Enable Connect at dashboard.stripe.com/connect.)" : ""}`
        : "Could not start checkout.";
    return c.json({ data: notReady(message) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/checkout/booking-intent — authorize (manual capture) a booking.
// The card is AUTHORIZED now; funds are captured only when the provider accepts.
// ---------------------------------------------------------------------------
checkoutRouter.post("/booking-intent", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = BookingIntentRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid booking request", code: "bad_request" } }, 400);
  }
  const { service_id, provider_user_id, date, time_start } = parsed.data;
  let createdBookingId: string | null = null;

  const blocked = (message: string): BookingIntentResponse => ({
    booking_id: null,
    client_secret: null,
    service_price_cents: 0,
    platform_fee_cents: 0,
    amount_total: 0,
    test_mode: isTestMode(),
    message,
  });

  if (!stripeConfigured() || !supabaseConfigured()) {
    return c.json({ data: blocked("Payments are not configured yet.") });
  }

  try {
    const services = await sbSelect<{
      service_id: string;
      provider_id: string;
      price_cents: number | null;
      duration: number | null;
      name: string | null;
    }>("services", `service_id=eq.${encodeURIComponent(service_id)}&select=*&limit=1`);
    const service = services[0];
    if (!service) return c.json({ error: { message: "Service not found", code: "not_found" } }, 404);
    if (service.provider_id !== provider_user_id) {
      return c.json({ error: { message: "Provider mismatch", code: "bad_request" } }, 400);
    }

    const price = service.price_cents ?? 0;
    if (price <= 0) return c.json({ data: blocked("This is a free service — no payment needed.") });

    const providerAccount = await activeConnectAccount(provider_user_id);
    if (!providerAccount) {
      return c.json({ data: blocked("This provider hasn't activated payments yet.") });
    }

    const breakdown = singleBreakdown(price);
    const duration = service.duration ?? 60;
    const normalizedStart = normalizeTime(time_start);
    const [h, m] = normalizedStart.split(":").map((n) => parseInt(n, 10));
    const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + duration);
    const time_end = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;

    // Reuse a recent unresolved intent for the same booking slot. This keeps
    // rapid repeated booking clicks from creating multiple PaymentIntents.
    const existingBookings = await sbSelect<{
      id: string;
      payment_intent_id: string | null;
      created_at: string | null;
    }>(
      "bookings",
      [
        `customer_id=eq.${encodeURIComponent(userId)}`,
        `provider_id=eq.${encodeURIComponent(provider_user_id)}`,
        `service_id=eq.${encodeURIComponent(service_id)}`,
        `date=eq.${encodeURIComponent(date)}`,
        `time_start=eq.${encodeURIComponent(normalizedStart)}`,
        "status=eq.pending_provider_review",
        "payment_status=eq.none",
        "select=id,payment_intent_id,created_at",
        "order=created_at.desc",
        "limit=1",
      ].join("&"),
    );
    const existingBooking = existingBookings[0];
    if (existingBooking?.payment_intent_id && stripe) {
      const ageMs = existingBooking.created_at ? Date.now() - Date.parse(existingBooking.created_at) : 0;
      if (ageMs >= 0 && ageMs < 15 * 60 * 1000) {
        const existingIntent = await stripe.paymentIntents.retrieve(existingBooking.payment_intent_id);
        if (
          existingIntent.client_secret &&
          ["requires_payment_method", "requires_confirmation", "requires_action", "requires_capture"].includes(
            existingIntent.status,
          )
        ) {
          const resp: BookingIntentResponse = {
            booking_id: existingBooking.id,
            client_secret: existingIntent.client_secret,
            service_price_cents: breakdown.service_price_cents,
            platform_fee_cents: breakdown.platform_fee_cents,
            amount_total: breakdown.amount_total,
            test_mode: isTestMode(),
            message: null,
          };
          return c.json({ data: resp });
        }
      }
    }

    // Create the booking up front in the "awaiting provider" state.
    const bookingRows = await sbInsert<{ id: string }>(
      "bookings",
      {
        customer_id: userId,
        provider_id: provider_user_id,
        service_id,
        date,
        time_start: normalizedStart,
        time_end,
        status: "pending_provider_review",
        payment_status: "none",
        ...breakdown,
      },
      { returning: true },
    );
    const booking = bookingRows[0];
    if (!booking) throw new Error("Could not create booking");
    createdBookingId = booking.id;

    const intent = await stripe!.paymentIntents.create({
      amount: breakdown.amount_total,
      currency: "usd",
      capture_method: "manual", // authorize now, capture on provider accept
      application_fee_amount: breakdown.platform_fee_cents,
      transfer_data: { destination: providerAccount },
      on_behalf_of: providerAccount,
      automatic_payment_methods: { enabled: true },
      metadata: { kind: "booking", booking_id: booking.id, customer_id: userId },
    });

    await sbUpdate("bookings", `id=eq.${booking.id}`, {
      payment_intent_id: intent.id,
      updated_at: new Date().toISOString(),
    });

    const resp: BookingIntentResponse = {
      booking_id: booking.id,
      client_secret: intent.client_secret ?? null,
      service_price_cents: breakdown.service_price_cents,
      platform_fee_cents: breakdown.platform_fee_cents,
      amount_total: breakdown.amount_total,
      test_mode: isTestMode(),
      message: null,
    };
    return c.json({ data: resp });
  } catch (e) {
    if (createdBookingId) {
      await sbDelete("bookings", `id=eq.${encodeURIComponent(createdBookingId)}&payment_intent_id=is.null`).catch(
        () => undefined,
      );
    }
    const message = e instanceof Error ? e.message : "Could not start booking checkout.";
    if (/invalid input syntax|bad request|invalid/i.test(message)) {
      return c.json({ error: { message, code: "bad_request" } }, 400);
    }
    return c.json({ error: { message, code: "booking_intent_failed" } }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/checkout/session/:id/status — poll a ticket order (receipt page).
// `:id` is the yardtix_orders id.
// ---------------------------------------------------------------------------
checkoutRouter.get("/session/:id/status", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);
  const id = c.req.param("id");

  if (!supabaseConfigured()) {
    return c.json({ error: { message: "Not configured", code: "unavailable" } }, 503);
  }

  const orders = await sbSelect<{
    id: string;
    buyer_id: string;
    payment_status: string | null;
    receipt_url: string | null;
  }>("yardtix_orders", `id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  const order = orders[0];
  if (!order || order.buyer_id !== userId) {
    return c.json({ error: { message: "Order not found", code: "not_found" } }, 404);
  }

  const tickets = await sbSelect<{ id: string }>(
    "yardtix_tickets",
    `order_id=eq.${encodeURIComponent(id)}&select=id`,
  );

  const resp: SessionStatusResponse = {
    order_id: order.id,
    payment_status: order.payment_status ?? "pending",
    ticket_count: tickets.length,
    receipt_url: order.receipt_url ?? null,
  };
  return c.json({ data: resp });
});

export { checkoutRouter };
