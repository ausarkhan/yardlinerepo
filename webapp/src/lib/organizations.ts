// Organizations domain layer (Phase 6).
//
// Reuses the existing events table for org-hosted events (events.organization_id +
// host_type). All access is RLS-enforced (migration 0005): discovery shows active
// orgs; member/officer/leader powers are gated by org role.

import { supabase } from "./supabase";
import type {
  Organization,
  OrganizationMember,
  OrgJoinRequest,
  OrgAnnouncement,
  OrgActivity,
  OrgRole,
  OrgCategory,
  OrgAnnouncementVisibility,
  Profile,
  YardEvent,
  Conversation,
  Message,
} from "./types";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const ORG_CATEGORIES: { value: OrgCategory; label: string }[] = [
  { value: "academic", label: "Academic" },
  { value: "cultural", label: "Cultural" },
  { value: "greek_life", label: "Greek Life" },
  { value: "student_government", label: "Student Government" },
  { value: "service", label: "Service" },
  { value: "religious", label: "Religious / Spiritual" },
  { value: "professional", label: "Professional" },
  { value: "social", label: "Social" },
  { value: "athletics", label: "Athletics / Recreation" },
  { value: "other", label: "Other" },
];

export function orgCategoryLabel(value: string | null | undefined): string {
  return ORG_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

// ---------------------------------------------------------------------------
// Permission model (mirror of the SQL helpers in migration 0005)
// ---------------------------------------------------------------------------
export const OFFICER_ROLES: OrgRole[] = ["officer", "president", "admin"];
export const LEADER_ROLES: OrgRole[] = ["president", "admin"];
export const APPROVER_ROLES: OrgRole[] = ["officer", "president", "admin", "advisor"];

export function isOfficer(role: string | null | undefined): boolean {
  return !!role && OFFICER_ROLES.includes(role as OrgRole);
}
export function isLeader(role: string | null | undefined): boolean {
  return !!role && LEADER_ROLES.includes(role as OrgRole);
}
export function isApprover(role: string | null | undefined): boolean {
  return !!role && APPROVER_ROLES.includes(role as OrgRole);
}
export function canManageBudget(role: string | null | undefined): boolean {
  return !!role && ["president", "treasurer", "officer", "advisor", "admin"].includes(role);
}
export function canViewFinancials(role: string | null | undefined): boolean {
  return role === "treasurer" || isLeader(role);
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  member: "Member",
  officer: "Officer",
  president: "President",
  treasurer: "Treasurer",
  advisor: "Advisor",
  admin: "Admin",
};

// Roles an officer/leader can assign from the dashboard.
export const ASSIGNABLE_ROLES: OrgRole[] = [
  "member",
  "officer",
  "treasurer",
  "advisor",
  "president",
];

// ---------------------------------------------------------------------------
// Organizations CRUD
// ---------------------------------------------------------------------------
export interface OrgInput {
  name: string;
  description: string;
  category: OrgCategory;
  mission: string;
  logo: string;
  cover: string;
  contact_email: string;
  social_links: Record<string, string>;
  advisor_name: string;
  advisor_email: string;
  department: string;
  membership_policy?: "open" | "approval_required" | "closed";
  verification_level?: "community" | "verified";
}

export async function listOrganizations(opts?: {
  search?: string;
  category?: OrgCategory | "all";
}): Promise<Organization[]> {
  let q = supabase.from("organizations").select("*").eq("status", "active").order("name");
  if (opts?.category && opts.category !== "all") q = q.eq("category", opts.category);
  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(`name.ilike.${s},description.ilike.${s},department.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Organization[];
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const { data, error } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Organization) ?? null;
}

export async function createOrganization(input: OrgInput, userId: string): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: input.name.trim(),
      description: input.description.trim() || null,
      category: input.category,
      mission: input.mission.trim() || null,
      logo: input.logo.trim() || null,
      cover: input.cover.trim() || null,
      contact_email: input.contact_email.trim() || null,
      social_links: input.social_links,
      advisor_name: input.advisor_name.trim() || null,
      advisor_email: input.advisor_email.trim() || null,
      department: input.department.trim() || null,
      membership_policy: input.membership_policy ?? "approval_required",
      verification_level: input.verification_level ?? "community",
      status: "active",
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  // The DB trigger seeds the creator as president; nothing else to do here.
  return data as Organization;
}

export async function updateOrganization(id: string, input: Partial<OrgInput>): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------
export async function listMembers(orgId: string): Promise<OrganizationMember[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("joined_at");
  if (error) throw error;
  return (data ?? []) as OrganizationMember[];
}

// The signed-in user's memberships (joined with the organization).
export interface MyMembership extends OrganizationMember {
  organization: Organization | null;
}
export async function myMemberships(userId: string): Promise<MyMembership[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  const rows = (data ?? []) as OrganizationMember[];
  if (rows.length === 0) return [];
  const orgIds = rows.map((r) => r.organization_id);
  const { data: orgs } = await supabase.from("organizations").select("*").in("id", orgIds);
  const map: Record<string, Organization> = {};
  (orgs ?? []).forEach((o) => (map[(o as Organization).id] = o as Organization));
  return rows.map((r) => ({ ...r, organization: map[r.organization_id] ?? null }));
}

export async function myMembership(orgId: string, userId: string): Promise<OrganizationMember | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as OrganizationMember) ?? null;
}

export async function setMemberRole(member: OrganizationMember, role: OrgRole): Promise<void> {
  if (member.role === "president" && role !== "president") {
    const members = await listMembers(member.organization_id);
    const presidents = members.filter((m) => m.role === "president" && m.status === "active");
    if (presidents.length <= 1) {
      throw new Error("Assign another president before changing this role.");
    }
  }
  const { error } = await supabase.from("organization_members").update({ role }).eq("id", member.id);
  if (error) throw error;
}

export async function removeMember(member: OrganizationMember): Promise<void> {
  if (member.role === "president") {
    const members = await listMembers(member.organization_id);
    const presidents = members.filter((m) => m.role === "president" && m.status === "active");
    if (presidents.length <= 1) {
      throw new Error("Organizations must have at least one president.");
    }
  }
  const { error } = await supabase.from("organization_members").delete().eq("id", member.id);
  if (error) throw error;
}

export async function leaveOrganization(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) throw error;
}

// Hydrate member profiles for a member list.
export async function fetchMemberProfiles(members: OrganizationMember[]): Promise<Record<string, Profile>> {
  const ids = Array.from(new Set(members.map((m) => m.user_id)));
  if (ids.length === 0) return {};
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  const map: Record<string, Profile> = {};
  (data ?? []).forEach((p) => (map[(p as Profile).id] = p as Profile));
  return map;
}

// ---------------------------------------------------------------------------
// Join requests
// ---------------------------------------------------------------------------
export interface JoinRequestInput {
  message: string;
  classification_year?: string;
  major?: string;
  interests?: string;
}

export async function joinOpenOrganization(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role: "member", status: "active" });
  if (error) throw error;
}

export async function requestToJoin(orgId: string, userId: string, input?: JoinRequestInput): Promise<void> {
  const { error } = await supabase
    .from("organization_join_requests")
    .insert({
      organization_id: orgId,
      user_id: userId,
      message: input?.message?.trim() || null,
      classification_year: input?.classification_year?.trim() || null,
      major: input?.major?.trim() || null,
      interests: input?.interests?.trim() || null,
    });
  if (error) throw error;
}

export async function myJoinRequest(orgId: string, userId: string): Promise<OrgJoinRequest | null> {
  const { data, error } = await supabase
    .from("organization_join_requests")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as OrgJoinRequest) ?? null;
}

export async function myPendingJoinRequests(userId: string): Promise<OrgJoinRequest[]> {
  const { data, error } = await supabase
    .from("organization_join_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrgJoinRequest[];
}

export async function listJoinRequests(orgId: string, status = "pending"): Promise<OrgJoinRequest[]> {
  const { data, error } = await supabase
    .from("organization_join_requests")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrgJoinRequest[];
}

// Approve → also create the membership (RLS lets approvers insert members).
export async function decideJoinRequest(
  request: OrgJoinRequest,
  approve: boolean,
  deciderId: string,
): Promise<void> {
  if (approve) {
    const { error: memberErr } = await supabase
      .from("organization_members")
      .insert({ organization_id: request.organization_id, user_id: request.user_id, role: "member" })
      .select()
      .maybeSingle();
    // Ignore unique-violation if they're already a member.
    if (memberErr && memberErr.code !== "23505") throw memberErr;
  }
  const { error } = await supabase
    .from("organization_join_requests")
    .update({
      status: approve ? "approved" : "denied",
      decided_by: deciderId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", request.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export async function listAnnouncements(orgId: string): Promise<OrgAnnouncement[]> {
  const { data, error } = await supabase
    .from("organization_announcements")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrgAnnouncement[];
}

export async function listAnnouncementsForOrgs(orgIds: string[], limit = 6): Promise<OrgAnnouncement[]> {
  if (orgIds.length === 0) return [];
  const { data, error } = await supabase
    .from("organization_announcements")
    .select("*")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as OrgAnnouncement[];
}

export async function postAnnouncement(input: {
  orgId: string;
  authorId: string;
  title: string;
  body: string;
  visibility: OrgAnnouncementVisibility;
}): Promise<void> {
  const { error } = await supabase.from("organization_announcements").insert({
    organization_id: input.orgId,
    author_id: input.authorId,
    title: input.title.trim(),
    body: input.body.trim() || null,
    visibility: input.visibility,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Shared organization inbox
// ---------------------------------------------------------------------------
function orgInboxParticipant(orgId: string): string {
  return `org:${orgId}`;
}

export interface OrgConversationView extends Conversation {
  requester: Profile | null;
  unread: number;
}

export async function getOrCreateOrgConversation(input: {
  orgId: string;
  userId: string;
  initialMessage?: string;
}): Promise<Conversation> {
  const orgParticipant = orgInboxParticipant(input.orgId);
  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("participant_a", input.userId)
    .eq("participant_b", orgParticipant)
    .eq("context_type", "organization")
    .eq("context_id", input.orgId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as Conversation;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      participant_a: input.userId,
      participant_b: orgParticipant,
      context_type: "organization",
      context_id: input.orgId,
    })
    .select()
    .single();
  if (error) throw error;
  const convo = data as Conversation;
  if (input.initialMessage?.trim()) {
    await sendOrgInboxMessage(convo.id, input.userId, input.initialMessage);
  }
  return convo;
}

export async function listOrgInbox(orgId: string): Promise<OrgConversationView[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("context_type", "organization")
    .eq("context_id", orgId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const convos = (data ?? []) as Conversation[];
  if (convos.length === 0) return [];

  const requesterIds = Array.from(new Set(convos.map((c) => c.participant_a)));
  const [{ data: profiles }, { data: unreadRows }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", requesterIds),
    supabase
      .from("messages")
      .select("conversation_id,sender_id")
      .in("conversation_id", convos.map((c) => c.id))
      .is("read_at", null),
  ]);
  const profileMap: Record<string, Profile> = {};
  (profiles ?? []).forEach((p) => (profileMap[(p as Profile).id] = p as Profile));
  const requesterByConversation: Record<string, string> = {};
  convos.forEach((c) => {
    requesterByConversation[c.id] = c.participant_a;
  });
  const unread: Record<string, number> = {};
  (unreadRows ?? []).forEach((r) => {
    const row = r as { conversation_id: string; sender_id: string };
    if (row.sender_id === requesterByConversation[row.conversation_id]) {
      unread[row.conversation_id] = (unread[row.conversation_id] ?? 0) + 1;
    }
  });

  return convos.map((c) => ({
    ...c,
    requester: profileMap[c.participant_a] ?? null,
    unread: unread[c.id] ?? 0,
  }));
}

export async function listOrgInboxMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendOrgInboxMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

// ---------------------------------------------------------------------------
// Activity + events
// ---------------------------------------------------------------------------
export async function listActivity(orgId: string, limit = 30): Promise<OrgActivity[]> {
  const { data, error } = await supabase
    .from("organization_activity_log")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as OrgActivity[];
}

// Events hosted by an organization (reuses the events table).
export async function listOrgEvents(orgId: string): Promise<YardEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("organization_id", orgId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as YardEvent[];
}

export async function upcomingEventCounts(orgIds: string[]): Promise<Record<string, number>> {
  if (orgIds.length === 0) return {};
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select("organization_id")
    .in("organization_id", orgIds)
    .gte("date", today);
  if (error) throw error;
  const map: Record<string, number> = {};
  (data ?? []).forEach((e) => {
    const id = (e as { organization_id: string | null }).organization_id;
    if (id) map[id] = (map[id] ?? 0) + 1;
  });
  return map;
}
