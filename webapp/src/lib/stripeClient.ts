// Stripe.js loader (frontend). The publishable key is safe to ship to the
// browser. When it's absent, paid flows hard-disable (see isStripeConfigured).
import { loadStripe, type Stripe } from "@stripe/stripe-js";

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export function isStripeConfigured(): boolean {
  return !!PUBLISHABLE_KEY;
}

// Single shared promise — Stripe.js must only be loaded once per page.
let _promise: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) return Promise.resolve(null);
  if (!_promise) _promise = loadStripe(PUBLISHABLE_KEY);
  return _promise;
}

// The app's public origin, used to build Stripe return URLs.
export function appOrigin(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}
