// Legal / waiver acceptance domain layer (Phase 5).
//
// Users must accept Terms, Privacy, and the Waiver before: becoming a provider,
// creating a paid event, booking a service, or buying a ticket. Each acceptance
// is one row in waiver_acceptances (document + version), so re-acceptance after a
// version bump is just a new row.

import { supabase } from "./supabase";
import type { LegalDocument, WaiverAcceptance } from "./types";

// Bump a version string when that document's terms materially change — users will
// be asked to re-accept the next time they hit a gated action.
export const LEGAL_VERSIONS: Record<LegalDocument, string> = {
  terms: "2026-06-01",
  privacy: "2026-06-01",
  waiver: "2026-06-01",
};

export const REQUIRED_DOCUMENTS: LegalDocument[] = ["terms", "privacy", "waiver"];

export const LEGAL_LABELS: Record<LegalDocument, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  waiver: "Liability Waiver",
};

// All acceptance rows for a user (latest first).
export async function getAcceptances(userId: string): Promise<WaiverAcceptance[]> {
  const { data, error } = await supabase
    .from("waiver_acceptances")
    .select("*")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WaiverAcceptance[];
}

// Which required documents the user has NOT accepted at the CURRENT version.
export function outstandingDocuments(rows: WaiverAcceptance[]): LegalDocument[] {
  return REQUIRED_DOCUMENTS.filter(
    (doc) => !rows.some((r) => r.document === doc && r.waiver_version === LEGAL_VERSIONS[doc]),
  );
}

export function hasAcceptedAll(rows: WaiverAcceptance[]): boolean {
  return outstandingDocuments(rows).length === 0;
}

// Record acceptance for the given documents at their current versions.
export async function acceptDocuments(
  userId: string,
  documents: LegalDocument[],
): Promise<void> {
  if (documents.length === 0) return;
  const nowIso = new Date().toISOString();
  const rows = documents.map((doc) => ({
    user_id: userId,
    document: doc,
    waiver_version: LEGAL_VERSIONS[doc],
    accepted_at: nowIso,
  }));
  const { error } = await supabase.from("waiver_acceptances").insert(rows);
  if (error) throw error;
}
