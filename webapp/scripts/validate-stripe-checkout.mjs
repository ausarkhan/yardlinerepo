const sessionId = process.argv[2];
const key = process.env.STRIPE_SECRET_KEY;

if (!sessionId) {
  console.error("Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/validate-stripe-checkout.mjs cs_test_...");
  process.exit(2);
}

if (!key) {
  console.error("Missing STRIPE_SECRET_KEY. Use a Stripe test secret key for the account that created the Checkout Session.");
  process.exit(2);
}

const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;

async function stripeGet(path, params = {}) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(name, item));
    } else if (value != null) {
      url.searchParams.set(name, value);
    }
  }
  const response = await fetch(url, { headers: { Authorization: auth } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stripe ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

const session = await stripeGet(`checkout/sessions/${sessionId}`, {
  "expand[]": ["payment_intent", "line_items"],
});

const paymentIntent =
  typeof session.payment_intent === "string" || session.payment_intent == null
    ? session.payment_intent
    : {
        id: session.payment_intent.id,
        status: session.payment_intent.status,
        amount: session.payment_intent.amount,
        amount_received: session.payment_intent.amount_received,
        currency: session.payment_intent.currency,
        latest_charge: session.payment_intent.latest_charge,
      };

const events = await stripeGet("events", {
  limit: 20,
  "types[]": [
    "checkout.session.completed",
    "checkout.session.expired",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.canceled",
  ],
});

const relatedEvents = (events.data ?? [])
  .filter((event) => {
    const object = event.data.object;
    if (!object || typeof object !== "object") return false;
    const objectId = "id" in object ? object.id : undefined;
    const piId =
      "payment_intent" in object && typeof object.payment_intent === "string"
        ? object.payment_intent
        : undefined;
    const expandedPiId =
      typeof paymentIntent === "object" && paymentIntent !== null ? paymentIntent.id : paymentIntent;
    return objectId === session.id || objectId === expandedPiId || piId === expandedPiId;
  })
  .map((event) => ({
    id: event.id,
    type: event.type,
    created: new Date(event.created * 1000).toISOString(),
    object: event.data.object.id,
  }));

const paymentIntentStatus =
  typeof paymentIntent === "object" && paymentIntent !== null ? paymentIntent.status : null;

function classifySession() {
  if (session.status === "expired") return "expired";
  if (session.status === "complete" && session.payment_status === "paid") {
    if (paymentIntentStatus === "succeeded") return "complete_paid_payment_intent_succeeded";
    if (paymentIntentStatus) return `complete_paid_payment_intent_${paymentIntentStatus}`;
    return "complete_paid_no_expanded_payment_intent";
  }
  if (paymentIntentStatus === "canceled") return "payment_intent_canceled";
  if (paymentIntentStatus === "requires_payment_method") return "payment_intent_failed_or_requires_payment_method";
  if (paymentIntentStatus && paymentIntentStatus !== "succeeded") return `payment_intent_${paymentIntentStatus}`;
  if (session.status === "open" && session.payment_status === "unpaid" && !paymentIntent) {
    return "open_unpaid_no_payment_intent";
  }
  return `${session.status}_${session.payment_status}`;
}

console.log(
  JSON.stringify(
    {
      classification: classifySession(),
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        client_reference_id: session.client_reference_id,
        expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        url_present: !!session.url,
      },
      payment_intent: paymentIntent,
      related_events: relatedEvents,
    },
    null,
    2,
  ),
);
