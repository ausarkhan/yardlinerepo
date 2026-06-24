// Stripe Connect data layer (frontend).
//
// Mirrors backend/src/types.ts → ConnectStatusResponse / ConnectOnboardResponse
// (the single source of truth). Account state lives in the Supabase
// `stripe_connect_accounts` table; the secret-key Stripe calls run server-side,
// so we go through the backend, authenticated with the user's Supabase token.

import { api } from "./api";
import { supabase } from "./supabase";

export type ConnectStatus =
  | "not_activated"
  | "pending_verification"
  | "restricted"
  | "active";

export interface ConnectStatusResponse {
  status: ConnectStatus;
  account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  updated_at: string | null;
  test_mode: boolean;
  message?: string | null;
}

export interface ConnectOnboardResponse {
  url: string | null;
  message?: string | null;
}

const NOT_ACTIVATED: ConnectStatusResponse = {
  status: "not_activated",
  account_id: null,
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  updated_at: null,
  test_mode: true,
  message: null,
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Live status (the backend syncs charges/payouts from Stripe before returning).
// Falls back to "not activated" if the backend is unreachable so the tab still renders.
export async function fetchConnectStatus(): Promise<ConnectStatusResponse> {
  try {
    return await api.get<ConnectStatusResponse>("/api/payments/connect/status", {
      headers: await authHeader(),
    });
  } catch {
    return NOT_ACTIVATED;
  }
}

// Start (or resume) Connect onboarding — returns the Stripe-hosted link to redirect to.
export async function startConnectOnboarding(origin: string): Promise<ConnectOnboardResponse> {
  return api.post<ConnectOnboardResponse>(
    "/api/payments/connect/onboard",
    { origin },
    { headers: await authHeader() },
  );
}

// ---- display helpers -------------------------------------------------------

export function connectStatusLabel(status: ConnectStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending_verification":
      return "Pending verification";
    case "restricted":
      return "Restricted";
    case "not_activated":
    default:
      return "Not activated";
  }
}

export function connectStatusStyle(status: ConnectStatus): string {
  switch (status) {
    case "active":
      return "bg-green/15 text-green border-green/30";
    case "pending_verification":
      return "bg-primary/15 text-primary border-primary/30";
    case "restricted":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "not_activated":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
