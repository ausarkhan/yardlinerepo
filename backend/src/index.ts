import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { sampleRouter } from "./routes/sample";
import { connectRouter } from "./routes/connect";
import { checkoutRouter } from "./routes/checkout";
import { bookingsRouter } from "./routes/bookings";
import { checkinRouter } from "./routes/checkin";
import { webhooksRouter } from "./routes/webhooks";
import { logger } from "hono/logger";

const app = new Hono();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/payments/connect", connectRouter);
// Phase 4 — Stripe payments
app.route("/api/checkout", checkoutRouter); // event-session, booking-intent, session status
app.route("/api/bookings", bookingsRouter); // provider accept / decline (capture / release)
// Phase 5 — Ticket check-in
app.route("/api/checkin", checkinRouter); // host scan + event summary roster
app.route("/api/webhooks", webhooksRouter); // signature-verified Stripe webhook

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
