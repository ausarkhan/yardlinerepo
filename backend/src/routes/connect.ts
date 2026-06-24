import { Hono } from "hono";
import Stripe from "stripe";
import {
  ConnectOnboardRequest,
  type ConnectOnboardResponse,
  type ConnectStatus,
  type ConnectStatusResponse,
} from "../types";

// Stripe Connect onboarding for YardLine creators (event hosts & service
// providers). The webapp talks to Supabase directly for everything else; only
// the secret-key Stripe calls live here. Account state is persisted to the
// existing `stripe_connect_accounts` table via the Supabase service role.

const connectRouter = new Hono();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

// ---------------------------------------------------------------------------
// Auth — resolve the caller's user id from their Supabase access token.
// ---------------------------------------------------------------------------
async function getUserId(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// stripe_connect_accounts persistence (service role bypasses RLS).
// ---------------------------------------------------------------------------
interface ConnectRow {
  id?: string;
  user_id: string;
  account_id: string | null;
  status: string | null;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  onboarding_url: string | null;
  updated_at: string | null;
}

function sbHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function getRow(userId: string): Promise<ConnectRow | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stripe_connect_accounts?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as ConnectRow[];
  return rows[0] ?? null;
}

async function upsertRow(userId: string, patch: Partial<ConnectRow>): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  const existing = await getRow(userId);
  const body = { ...patch, user_id: userId, updated_at: new Date().toISOString() };
  if (existing) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/stripe_connect_accounts?user_id=eq.${encodeURIComponent(userId)}`,
      { method: "PATCH", headers: sbHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(body) },
    );
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/stripe_connect_accounts`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(body),
    });
  }
}

// Derive the creator-facing status from a Stripe account's capability flags.
function deriveStatus(acct: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}): ConnectStatus {
  if (acct.charges_enabled && acct.payouts_enabled) return "active";
  if (acct.details_submitted) return "restricted"; // submitted but a requirement blocks payouts/charges
  return "pending_verification";
}

function statusFromRow(row: ConnectRow | null): ConnectStatusResponse {
  return {
    status: (row?.account_id ? (row.status as ConnectStatus) ?? "pending_verification" : "not_activated"),
    account_id: row?.account_id ?? null,
    charges_enabled: row?.charges_enabled ?? false,
    payouts_enabled: row?.payouts_enabled ?? false,
    details_submitted: row?.details_submitted ?? false,
    updated_at: row?.updated_at ?? null,
    test_mode: !STRIPE_KEY || STRIPE_KEY.startsWith("sk_test_"),
    message: null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/payments/connect/status — read + live-sync the caller's account.
// ---------------------------------------------------------------------------
connectRouter.get("/status", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) {
    return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);
  }

  const row = await getRow(userId);

  // No Stripe configured, or no account yet — return whatever we have.
  if (!stripe || !row?.account_id) {
    const resp = statusFromRow(row);
    if (!stripe) resp.message = "Payments are not configured yet.";
    return c.json({ data: resp });
  }

  // Live-sync capability flags from Stripe, then persist.
  try {
    const acct = await stripe.accounts.retrieve(row.account_id);
    const status = deriveStatus(acct);
    await upsertRow(userId, {
      status,
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      details_submitted: !!acct.details_submitted,
    });
    const resp: ConnectStatusResponse = {
      status,
      account_id: row.account_id,
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      details_submitted: !!acct.details_submitted,
      updated_at: new Date().toISOString(),
      test_mode: STRIPE_KEY!.startsWith("sk_test_"),
      message: null,
    };
    return c.json({ data: resp });
  } catch (e) {
    // Account vanished or Stripe error — fall back to stored row.
    const resp = statusFromRow(row);
    resp.message = e instanceof Error ? e.message : "Could not reach Stripe.";
    return c.json({ data: resp });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/connect/onboard — create/retrieve account + hosted link.
// ---------------------------------------------------------------------------
connectRouter.post("/onboard", async (c) => {
  const userId = await getUserId(c.req.header("Authorization"));
  if (!userId) {
    return c.json({ error: { message: "Not authenticated", code: "unauthorized" } }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ConnectOnboardRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request", code: "bad_request" } }, 400);
  }
  const { origin } = parsed.data;

  if (!stripe) {
    const resp: ConnectOnboardResponse = {
      url: null,
      message: "Stripe is not configured. Add STRIPE_SECRET_KEY to enable payments.",
    };
    return c.json({ data: resp });
  }

  try {
    // Reuse an existing Connect account, or create a fresh Express account.
    const row = await getRow(userId);
    let accountId = row?.account_id ?? null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        metadata: { yardline_user_id: userId },
      });
      accountId = account.id;
      await upsertRow(userId, {
        account_id: accountId,
        status: "pending_verification",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/creator-dashboard?tab=payments&connect=refresh`,
      return_url: `${origin}/creator-dashboard?tab=payments&connect=return`,
      type: "account_onboarding",
    });

    await upsertRow(userId, { onboarding_url: link.url });
    const resp: ConnectOnboardResponse = { url: link.url, message: null };
    return c.json({ data: resp });
  } catch (e) {
    // Most common cause: Connect isn't enabled on the platform's Stripe account.
    const message =
      e instanceof Error
        ? `${e.message} (Enable Connect at dashboard.stripe.com/connect to onboard creators.)`
        : "Could not start Stripe onboarding.";
    const resp: ConnectOnboardResponse = { url: null, message };
    return c.json({ data: resp });
  }
});

export { connectRouter };
