import { supabase } from "./supabase";
import type {
  BudgetFundingCategory,
  BudgetRequest,
  BudgetRequestAttachment,
  BudgetRequestComment,
  BudgetRequestDecision,
  BudgetRequestLineItem,
  BudgetRequestStatus,
  Organization,
} from "./types";

export const BUDGET_CATEGORIES: { value: BudgetFundingCategory; label: string }[] = [
  { value: "event_supplies", label: "Event supplies" },
  { value: "food_catering", label: "Food / catering" },
  { value: "venue", label: "Venue" },
  { value: "travel", label: "Travel" },
  { value: "speaker_performer", label: "Speaker / performer" },
  { value: "marketing", label: "Marketing" },
  { value: "equipment", label: "Equipment" },
  { value: "security", label: "Security" },
  { value: "decorations", label: "Decorations" },
  { value: "printing", label: "Printing" },
  { value: "other", label: "Other" },
];

export const BUDGET_STATUSES: { value: BudgetRequestStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "advisor_review", label: "Advisor review" },
  { value: "admin_review", label: "Admin review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "partially_approved", label: "Partially approved" },
  { value: "denied", label: "Denied" },
  { value: "cancelled", label: "Cancelled" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
];

export interface BudgetRequestInput {
  organization_id: string;
  title: string;
  description?: string;
  linked_event_id?: string | null;
  needed_by_date?: string | null;
  category: BudgetFundingCategory;
  purpose?: string;
  vendor_name?: string;
  vendor_email?: string;
  vendor_phone?: string;
  vendor_website?: string;
  advisor_name?: string;
  advisor_email?: string;
  admin_notes?: string;
}

export interface BudgetLineItemInput {
  id?: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_cost_cents: number;
  vendor?: string;
  notes?: string;
}

export interface BudgetRequestDetail {
  request: BudgetRequest;
  organization: Organization | null;
  lineItems: BudgetRequestLineItem[];
  attachments: BudgetRequestAttachment[];
  comments: BudgetRequestComment[];
  decisions: BudgetRequestDecision[];
}

export function budgetCategoryLabel(value: string | null | undefined): string {
  return BUDGET_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export function budgetStatusLabel(value: string | null | undefined): string {
  return BUDGET_STATUSES.find((s) => s.value === value)?.label ?? "Unknown";
}

function clean(input: BudgetRequestInput, userId?: string) {
  return {
    organization_id: input.organization_id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    linked_event_id: input.linked_event_id || null,
    needed_by_date: input.needed_by_date || null,
    category: input.category,
    purpose: input.purpose?.trim() || null,
    vendor_name: input.vendor_name?.trim() || null,
    vendor_email: input.vendor_email?.trim() || null,
    vendor_phone: input.vendor_phone?.trim() || null,
    vendor_website: input.vendor_website?.trim() || null,
    advisor_name: input.advisor_name?.trim() || null,
    advisor_email: input.advisor_email?.trim() || null,
    admin_notes: input.admin_notes?.trim() || null,
    ...(userId ? { created_by: userId } : {}),
  };
}

function linePayload(item: BudgetLineItemInput, requestId: string) {
  return {
    budget_request_id: requestId,
    item_name: item.item_name.trim(),
    description: item.description?.trim() || null,
    quantity: item.quantity,
    unit_cost_cents: item.unit_cost_cents,
    vendor: item.vendor?.trim() || null,
    notes: item.notes?.trim() || null,
  };
}

export async function listBudgetRequests(opts?: {
  organizationId?: string;
  status?: string;
  category?: string;
  neededByBefore?: string;
  admin?: boolean;
}): Promise<BudgetRequest[]> {
  let q = supabase.from("budget_requests").select("*").order("created_at", { ascending: false });
  if (opts?.organizationId) q = q.eq("organization_id", opts.organizationId);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts?.category && opts.category !== "all") q = q.eq("category", opts.category);
  if (opts?.neededByBefore) q = q.lte("needed_by_date", opts.neededByBefore);
  const { data, error } = await q.limit(opts?.admin ? 250 : 100);
  if (error) throw error;
  return (data ?? []) as BudgetRequest[];
}

export async function listOrgBudgetRequests(orgId: string): Promise<BudgetRequest[]> {
  return listBudgetRequests({ organizationId: orgId });
}

export async function getBudgetRequest(id: string): Promise<BudgetRequestDetail | null> {
  const { data: request, error } = await supabase.from("budget_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!request) return null;
  const br = request as BudgetRequest;
  const [orgRes, linesRes, attachmentsRes, commentsRes, decisionsRes] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", br.organization_id).maybeSingle(),
    supabase.from("budget_request_line_items").select("*").eq("budget_request_id", id).order("created_at"),
    supabase.from("budget_request_attachments").select("*").eq("budget_request_id", id).order("created_at"),
    supabase.from("budget_request_comments").select("*").eq("budget_request_id", id).order("created_at"),
    supabase.from("budget_request_decisions").select("*").eq("budget_request_id", id).order("created_at"),
  ]);
  if (orgRes.error) throw orgRes.error;
  if (linesRes.error) throw linesRes.error;
  if (attachmentsRes.error) throw attachmentsRes.error;
  if (commentsRes.error) throw commentsRes.error;
  if (decisionsRes.error) throw decisionsRes.error;
  return {
    request: br,
    organization: (orgRes.data as Organization) ?? null,
    lineItems: (linesRes.data ?? []) as BudgetRequestLineItem[],
    attachments: (attachmentsRes.data ?? []) as BudgetRequestAttachment[],
    comments: (commentsRes.data ?? []) as BudgetRequestComment[],
    decisions: (decisionsRes.data ?? []) as BudgetRequestDecision[],
  };
}

export async function createBudgetRequest(
  input: BudgetRequestInput,
  lineItems: BudgetLineItemInput[],
  userId: string,
): Promise<BudgetRequest> {
  const { data, error } = await supabase.from("budget_requests").insert(clean(input, userId)).select().single();
  if (error) throw error;
  const request = data as BudgetRequest;
  await replaceLineItems(request.id, lineItems);
  const detail = await getBudgetRequest(request.id);
  return detail?.request ?? request;
}

export async function updateBudgetRequest(
  id: string,
  input: BudgetRequestInput,
  lineItems: BudgetLineItemInput[],
): Promise<void> {
  const { error } = await supabase.from("budget_requests").update(clean(input)).eq("id", id);
  if (error) throw error;
  await replaceLineItems(id, lineItems);
}

export async function replaceLineItems(requestId: string, items: BudgetLineItemInput[]): Promise<void> {
  const { error: delErr } = await supabase.from("budget_request_line_items").delete().eq("budget_request_id", requestId);
  if (delErr) throw delErr;
  const payload = items.filter((i) => i.item_name.trim()).map((item) => linePayload(item, requestId));
  if (payload.length === 0) return;
  const { error } = await supabase.from("budget_request_line_items").insert(payload);
  if (error) throw error;
}

export async function transitionBudgetRequest(input: {
  id: string;
  status: BudgetRequestStatus;
  reason?: string;
  amountApprovedCents?: number | null;
  adminNotes?: string | null;
}): Promise<BudgetRequest> {
  const { data, error } = await supabase.rpc("budget_transition", {
    p_request_id: input.id,
    p_new_status: input.status,
    p_reason: input.reason ?? null,
    p_amount_approved_cents: input.amountApprovedCents ?? null,
    p_admin_notes: input.adminNotes ?? null,
  });
  if (error) throw error;
  return data as BudgetRequest;
}

export async function addBudgetComment(input: {
  requestId: string;
  actorId: string;
  body: string;
  visibility?: "organization" | "advisor_admin" | "admin";
}): Promise<void> {
  const { error } = await supabase.from("budget_request_comments").insert({
    budget_request_id: input.requestId,
    actor_id: input.actorId,
    body: input.body.trim(),
    visibility: input.visibility ?? "organization",
  });
  if (error) throw error;
}

export async function uploadBudgetAttachment(input: {
  requestId: string;
  userId: string;
  file: File;
  documentType?: string;
}): Promise<void> {
  const ext = input.file.name.split(".").pop()?.toLowerCase() ?? "file";
  const path = `${input.requestId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("budget-request-attachments")
    .upload(path, input.file, { upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("budget_request_attachments").insert({
    budget_request_id: input.requestId,
    uploaded_by: input.userId,
    file_name: input.file.name,
    file_path: path,
    file_type: input.file.type || null,
    file_size: input.file.size,
    document_type: input.documentType || "other",
  });
  if (error) throw error;
}

export async function signedAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("budget-request-attachments")
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export interface BudgetSummary {
  draft: number;
  submitted: number;
  advisor_review: number;
  admin_review: number;
  approved: number;
  partially_approved: number;
  denied: number;
  paid: number;
  totalRequested: number;
  totalApproved: number;
  totalPaid: number;
}

export function summarizeBudgetRequests(requests: BudgetRequest[]): BudgetSummary {
  const base: BudgetSummary = {
    draft: 0,
    submitted: 0,
    advisor_review: 0,
    admin_review: 0,
    approved: 0,
    partially_approved: 0,
    denied: 0,
    paid: 0,
    totalRequested: 0,
    totalApproved: 0,
    totalPaid: 0,
  };
  for (const request of requests) {
    if (request.status in base && typeof base[request.status as keyof BudgetSummary] === "number") {
      (base[request.status as keyof BudgetSummary] as number) += 1;
    }
    base.totalRequested += request.amount_requested_cents ?? 0;
    base.totalApproved += request.amount_approved_cents ?? 0;
    if (request.status === "paid") base.totalPaid += request.amount_approved_cents ?? 0;
  }
  return base;
}

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function budgetRequestsToCsv(rows: { request: BudgetRequest; organizationName?: string }[]): string {
  const header = [
    "Request ID",
    "Organization name",
    "Request title",
    "Amount requested",
    "Amount approved",
    "Status",
    "Needed-by date",
    "Vendor",
    "Category",
    "Created date",
    "Approved date",
    "Paid date",
  ];
  const body = rows.map(({ request, organizationName }) =>
    [
      request.id,
      organizationName ?? request.organization_id,
      request.title,
      ((request.amount_requested_cents ?? 0) / 100).toFixed(2),
      request.amount_approved_cents == null ? "" : (request.amount_approved_cents / 100).toFixed(2),
      budgetStatusLabel(request.status),
      request.needed_by_date ?? "",
      request.vendor_name ?? "",
      budgetCategoryLabel(request.category),
      request.created_at ?? "",
      request.approved_at ?? "",
      request.paid_at ?? "",
    ].map(csvCell).join(","),
  );
  return [header.map(csvCell).join(","), ...body].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
