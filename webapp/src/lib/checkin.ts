// Phase 5 check-in data layer (frontend).
//
// Talks to the host-gated check-in backend, authenticated with the user's
// Supabase access token (same pattern as lib/checkout.ts / lib/stripeConnect.ts).
// Response shapes mirror backend/src/types.ts — the single source of truth
// (CheckinScanRequest / CheckinScanResponse / CheckinSummaryResponse / etc.).

import { api } from "./api";
import { supabase } from "./supabase";

// ---- contract mirror (backend/src/types.ts) -------------------------------

export type CheckinResultCode =
  | "ok"
  | "already_used"
  | "not_found"
  | "wrong_event"
  | "not_authorized"
  | "invalid_status";

export interface CheckinTicket {
  id: string;
  ticket_number: string;
  event_id: string;
  event_title: string | null;
  holder_id: string;
  holder_name: string | null;
  tier_name: string | null;
  status: string; // confirmed | used | refunded | cancelled
  used_at: string | null;
}

export interface CheckinScanRequest {
  qr_token?: string;
  ticket_number?: string;
  event_id?: string;
}

export interface CheckinScanResponse {
  result: CheckinResultCode;
  ticket: CheckinTicket | null;
  message?: string | null;
}

export interface CheckinSummaryResponse {
  event_id: string;
  total: number;
  checked_in: number;
  remaining: number;
  tickets: CheckinTicket[];
}

// ---- auth ------------------------------------------------------------------

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---- calls -----------------------------------------------------------------

// Scan (camera) or manually enter a ticket and admit the holder.
export async function scanTicket(body: CheckinScanRequest): Promise<CheckinScanResponse> {
  return api.post<CheckinScanResponse>("/api/checkin/scan", body, {
    headers: await authHeader(),
  });
}

// Live roster + counts for the host's event.
export async function fetchCheckinSummary(eventId: string): Promise<CheckinSummaryResponse> {
  return api.get<CheckinSummaryResponse>(`/api/checkin/event/${eventId}/summary`, {
    headers: await authHeader(),
  });
}

// ---- display helpers -------------------------------------------------------

export function checkinResultLabel(result: CheckinResultCode): string {
  switch (result) {
    case "ok":
      return "Checked in";
    case "already_used":
      return "Already checked in";
    case "not_found":
      return "Ticket not found";
    case "wrong_event":
      return "Wrong event";
    case "not_authorized":
      return "Not authorized";
    case "invalid_status":
      return "Ticket not valid";
    default:
      return "Unknown result";
  }
}

// Tailwind tone for a result — green success, amber warning, red errors.
export function checkinResultTone(result: CheckinResultCode): "success" | "warning" | "error" {
  if (result === "ok") return "success";
  if (result === "already_used") return "warning";
  return "error";
}
