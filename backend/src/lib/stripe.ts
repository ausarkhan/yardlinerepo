// Shared Stripe client + helpers. The secret key lives only here (server-side).
import Stripe from "stripe";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

export const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

export function stripeConfigured(): boolean {
  return !!stripe;
}

export function isTestMode(): boolean {
  return !STRIPE_KEY || STRIPE_KEY.startsWith("sk_test_");
}

// Derive the creator-facing Connect status from a Stripe account's flags.
// (Shared with the webhook account.updated handler and the connect route.)
export type ConnectStatusValue =
  | "not_activated"
  | "pending_verification"
  | "restricted"
  | "active";

export function deriveConnectStatus(acct: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}): ConnectStatusValue {
  if (acct.charges_enabled && acct.payouts_enabled) return "active";
  if (acct.details_submitted) return "restricted";
  return "pending_verification";
}

export { STRIPE_KEY };
