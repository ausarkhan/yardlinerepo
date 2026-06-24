// Reporting domain layer (Phase 5).
//
// Any signed-in user can report an event, provider, user, or message. Reports
// land in the moderation queue (admins review via /admin/reports). RLS lets a
// reporter insert + read their own reports; admins read/update all.

import { supabase } from "./supabase";
import type { Report, ReportCategory, ReportTargetType } from "./types";

export const REPORT_CATEGORIES: { value: ReportCategory; label: string; description: string }[] = [
  { value: "spam", label: "Spam", description: "Unwanted, repetitive, or promotional content." },
  { value: "harassment", label: "Harassment", description: "Bullying, threats, or abusive behavior." },
  { value: "scam", label: "Scam or fraud", description: "Deceptive offers or payment fraud." },
  { value: "safety", label: "Safety concern", description: "Something that could put people at risk." },
  { value: "inappropriate", label: "Inappropriate content", description: "Explicit, offensive, or illegal content." },
  { value: "other", label: "Other", description: "Anything else that needs a moderator's attention." },
];

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  event: "Event",
  provider: "Provider",
  user: "User",
  message: "Message",
};

export interface SubmitReportInput {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  details?: string;
}

export async function submitReport(input: SubmitReportInput): Promise<Report> {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: input.reporterId,
      target_type: input.targetType,
      target_id: input.targetId,
      category: input.category,
      details: input.details?.trim() || null,
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Report;
}

// The caller's own submitted reports (so they can see status updates).
export async function myReports(reporterId: string): Promise<Report[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("reporter_id", reporterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Report[];
}
