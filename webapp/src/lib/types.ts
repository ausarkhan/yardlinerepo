// TypeScript shapes mirroring the existing Supabase schema.
// These are READ models for the YardLine web app. We never rename or drop columns.

export interface Profile {
  id: string;
  name: string | null;
  handle: string | null;
  email: string | null;
  avatar: string | null;
  banner?: string | null;
  bio?: string | null;
  social_links?: Record<string, string> | null;
  campus: string | null;
  joined_date: string | null;
  is_provider: boolean | null;
  updated_at: string | null;
  // Phase 5 — trust & safety (added by migration 0004). Optional so the app keeps
  // working against rows/columns that predate the migration.
  role?: "user" | "admin" | null;
  status?: "active" | "suspended" | null;
  suspended_at?: string | null;
  suspension_reason?: string | null;
}

// Embedded host/user blob stored as jsonb on events & providers (from the mobile app).
export interface EmbeddedUser {
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
  campus?: string;
  handle?: string;
  isProvider?: boolean;
  joinedDate?: string;
}

export interface TicketType {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  sold?: number;
  description?: string;
}

export interface YardEvent {
  id: string;
  title: string | null;
  description: string | null;
  date: string | null;
  time: string | null;
  end_time: string | null;
  location: string | null;
  category: string | null;
  host_id: string | null;
  host_data: EmbeddedUser | null;
  photos: string[] | null;
  rsvp_count: number | null;
  rsvp_users: string[] | null;
  is_hidden: boolean | null;
  is_free: boolean | null;
  ticket_price: number | null;
  max_tickets: number | null;
  tickets_sold: number | null;
  ticket_types: TicketType[] | null;
  refund_policy: { type?: string; note?: string } | null;
  sales_window: { start?: string; end?: string } | null;
  status: string | null;
  created_at: string | null;
  // Phase 6 — organization hosting (added by migration 0005). Optional so the app
  // keeps working against rows that predate the migration.
  organization_id?: string | null;
  host_type?: "user" | "organization" | string | null;
}

export interface ServiceProvider {
  id: string;
  user_id: string | null;
  user_data: EmbeddedUser | null;
  category: string | null;
  description: string | null;
  photos: string[] | null;
  is_available: boolean | null;
  response_time: string | null;
  is_hidden: boolean | null;
  service_types: unknown | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Service {
  service_id: string;
  provider_id: string | null;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  duration: number | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Review {
  id: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewer_handle: string | null;
  reviewer_avatar: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  target_avatar: string | null;
  score: number | null;
  message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Phase 5 read models (tables created by migration 0004).
// ---------------------------------------------------------------------------

export type ConversationContext = "direct" | "provider" | "booking" | "event" | "organization";

export interface Conversation {
  id: string;
  participant_a: string;
  participant_b: string;
  context_type: ConversationContext | string;
  context_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  created_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string | null;
}

export type LegalDocument = "terms" | "privacy" | "waiver";

export interface WaiverAcceptance {
  id: string;
  user_id: string;
  document: LegalDocument | string;
  waiver_version: string;
  accepted_at: string | null;
  created_at: string | null;
}

export type ReportTargetType = "event" | "provider" | "user" | "message";
export type ReportCategory =
  | "spam"
  | "harassment"
  | "scam"
  | "safety"
  | "inappropriate"
  | "other";
export type ReportStatus = "open" | "dismissed" | "actioned";

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType | string;
  target_id: string;
  category: ReportCategory | string;
  details: string | null;
  status: ReportStatus | string;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

export interface ModerationAction {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export type NotificationType =
  | "message"
  | "booking_accepted"
  | "booking_declined"
  | "booking_completed"
  | "review_received"
  | "event_reminder"
  | "report_update"
  | "admin_action"
  // Phase 6 — organizations
  | "org_join_request"
  | "org_join_approved"
  | "org_join_denied"
  | "org_announcement"
  | "org_role_assigned"
  | "org_event_created"
  // Phase 7 — budget requests
  | "budget_advisor_review_needed"
  | "budget_admin_review_needed"
  | "budget_request_changes_requested"
  | "budget_request_approved"
  | "budget_request_partially_approved"
  | "budget_request_denied"
  | "budget_request_paid"
  | "budget_comment_added";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Phase 6 read models (tables created by migration 0005).
// ---------------------------------------------------------------------------

export type OrgCategory =
  | "academic"
  | "cultural"
  | "greek_life"
  | "student_government"
  | "service"
  | "religious"
  | "professional"
  | "social"
  | "athletics"
  | "other";

export type OrgStatus = "pending" | "active" | "inactive" | "archived";

export type OrgRole = "member" | "officer" | "president" | "treasurer" | "advisor" | "admin";

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  category: OrgCategory | string;
  mission: string | null;
  logo: string | null;
  cover: string | null;
  contact_email: string | null;
  social_links: Record<string, string> | null;
  advisor_name: string | null;
  advisor_email: string | null;
  advisor_id: string | null;
  department: string | null;
  status: OrgStatus | string;
  membership_policy?: "open" | "approval_required" | "closed" | string;
  verification_level?: "community" | "verified" | string;
  member_count: number | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole | string;
  status: "active" | "removed" | string;
  joined_at: string | null;
  created_at: string | null;
}

export interface OrgJoinRequest {
  id: string;
  organization_id: string;
  user_id: string;
  message: string | null;
  classification_year?: string | null;
  major?: string | null;
  interests?: string | null;
  status: "pending" | "approved" | "denied" | string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string | null;
}

export type OrgAnnouncementVisibility = "public" | "members" | "officers";

export interface OrgAnnouncement {
  id: string;
  organization_id: string;
  author_id: string;
  title: string;
  body: string | null;
  visibility: OrgAnnouncementVisibility | string;
  created_at: string | null;
}

export interface OrgActivity {
  id: string;
  organization_id: string;
  actor_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Phase 7 read models (budget requests and campus funding workflow).
// ---------------------------------------------------------------------------

export type BudgetRequestStatus =
  | "draft"
  | "submitted"
  | "advisor_review"
  | "admin_review"
  | "changes_requested"
  | "approved"
  | "partially_approved"
  | "denied"
  | "cancelled"
  | "paid"
  | "closed";

export type BudgetFundingCategory =
  | "event_supplies"
  | "food_catering"
  | "venue"
  | "travel"
  | "speaker_performer"
  | "marketing"
  | "equipment"
  | "security"
  | "decorations"
  | "printing"
  | "other";

export interface BudgetRequest {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  linked_event_id: string | null;
  amount_requested_cents: number;
  amount_approved_cents: number | null;
  needed_by_date: string | null;
  category: BudgetFundingCategory | string;
  purpose: string | null;
  vendor_name: string | null;
  vendor_email: string | null;
  vendor_phone: string | null;
  vendor_website: string | null;
  advisor_name: string | null;
  advisor_email: string | null;
  status: BudgetRequestStatus | string;
  admin_notes: string | null;
  created_by: string;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BudgetRequestLineItem {
  id: string;
  budget_request_id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_cost_cents: number;
  total_cost_cents: number;
  vendor: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BudgetRequestAttachment {
  id: string;
  budget_request_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  document_type: string | null;
  created_at: string | null;
}

export interface BudgetRequestComment {
  id: string;
  budget_request_id: string;
  actor_id: string;
  body: string;
  visibility: "organization" | "advisor_admin" | "admin" | string;
  created_at: string | null;
}

export interface BudgetRequestDecision {
  id: string;
  budget_request_id: string;
  actor_id: string | null;
  previous_status: string | null;
  new_status: string;
  amount_approved_cents: number | null;
  reason: string | null;
  created_at: string | null;
}
