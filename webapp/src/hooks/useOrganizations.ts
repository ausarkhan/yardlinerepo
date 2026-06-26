import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  listMembers,
  myMemberships,
  myMembership,
  joinOpenOrganization,
  setMemberRole,
  removeMember,
  leaveOrganization,
  requestToJoin,
  myJoinRequest,
  myPendingJoinRequests,
  listJoinRequests,
  decideJoinRequest,
  listAnnouncements,
  listAnnouncementsForOrgs,
  postAnnouncement,
  listActivity,
  listOrgEvents,
  upcomingEventCounts,
  getOrCreateOrgConversation,
  listOrgInbox,
  listOrgInboxMessages,
  sendOrgInboxMessage,
  type OrgInput,
  type JoinRequestInput,
} from "@/lib/organizations";
import type { OrgCategory, OrgRole, OrgJoinRequest, OrgAnnouncementVisibility, OrganizationMember } from "@/lib/types";

// ---------------------------------------------------------------------------
// Discovery + profile
// ---------------------------------------------------------------------------
export function useOrganizations(search: string, category: OrgCategory | "all") {
  return useQuery({
    queryKey: ["organizations", search, category],
    queryFn: () => listOrganizations({ search, category }),
  });
}

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ["organization", id],
    enabled: !!id,
    queryFn: () => getOrganization(id!),
  });
}

export function useOrgUpcomingCounts(orgIds: string[]) {
  const key = orgIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["org-upcoming-counts", key],
    enabled: orgIds.length > 0,
    queryFn: () => upcomingEventCounts(orgIds),
  });
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------
export function useMyMemberships() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-memberships", userId],
    enabled: !!userId,
    queryFn: () => myMemberships(userId!),
  });
}

// The signed-in user's role in a specific org (null if not a member).
export function useMyOrgRole(orgId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-org-role", orgId, userId],
    enabled: !!orgId && !!userId,
    queryFn: () => myMembership(orgId!, userId!),
  });
}

export function useOrgMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-members", orgId],
    enabled: !!orgId,
    queryFn: () => listMembers(orgId!),
  });
}

export function useMyJoinRequest(orgId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-join-request", orgId, userId],
    enabled: !!orgId && !!userId,
    queryFn: () => myJoinRequest(orgId!, userId!),
  });
}

export function useMyPendingJoinRequests() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-pending-join-requests", userId],
    enabled: !!userId,
    queryFn: () => myPendingJoinRequests(userId!),
  });
}

export function useJoinRequests(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["org-join-requests", orgId],
    enabled: !!orgId && enabled,
    queryFn: () => listJoinRequests(orgId!),
  });
}

// ---------------------------------------------------------------------------
// Announcements + activity + events
// ---------------------------------------------------------------------------
export function useAnnouncements(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-announcements", orgId],
    enabled: !!orgId,
    queryFn: () => listAnnouncements(orgId!),
  });
}

export function useMyOrgAnnouncements(orgIds: string[]) {
  const key = orgIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["my-org-announcements", key],
    enabled: orgIds.length > 0,
    queryFn: () => listAnnouncementsForOrgs(orgIds),
  });
}

export function useOrgActivity(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["org-activity", orgId],
    enabled: !!orgId && enabled,
    queryFn: () => listActivity(orgId!),
  });
}

export function useOrgEvents(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-events", orgId],
    enabled: !!orgId,
    queryFn: () => listOrgEvents(orgId!),
  });
}

export function useOrgInbox(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["org-inbox", orgId],
    enabled: !!orgId && enabled,
    queryFn: () => listOrgInbox(orgId!),
  });
}

export function useOrgInboxMessages(conversationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["org-inbox-messages", conversationId],
    enabled: !!conversationId && enabled,
    queryFn: () => listOrgInboxMessages(conversationId!),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export function useOrgActions(orgId?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["organizations"] });
    qc.invalidateQueries({ queryKey: ["organization", orgId] });
    qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    qc.invalidateQueries({ queryKey: ["org-join-requests", orgId] });
    qc.invalidateQueries({ queryKey: ["my-memberships", userId] });
    qc.invalidateQueries({ queryKey: ["my-org-role", orgId, userId] });
    qc.invalidateQueries({ queryKey: ["my-join-request", orgId, userId] });
    qc.invalidateQueries({ queryKey: ["my-pending-join-requests", userId] });
    qc.invalidateQueries({ queryKey: ["org-announcements", orgId] });
  };
  const requireUser = () => {
    if (!userId) throw new Error("Please sign in.");
    return userId;
  };

  return {
    create: useMutation({
      mutationFn: (input: OrgInput) => createOrganization(input, requireUser()),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: Partial<OrgInput> }) => updateOrganization(v.id, v.input),
      onSuccess: invalidate,
    }),
    joinOpen: useMutation({
      mutationFn: (v: { orgId: string }) => joinOpenOrganization(v.orgId, requireUser()),
      onSuccess: invalidate,
    }),
    join: useMutation({
      mutationFn: (v: { orgId: string; input: JoinRequestInput }) =>
        requestToJoin(v.orgId, requireUser(), v.input),
      onSuccess: invalidate,
    }),
    leave: useMutation({
      mutationFn: (v: { orgId: string }) => leaveOrganization(v.orgId, requireUser()),
      onSuccess: invalidate,
    }),
    decideRequest: useMutation({
      mutationFn: (v: { request: OrgJoinRequest; approve: boolean }) =>
        decideJoinRequest(v.request, v.approve, requireUser()),
      onSuccess: invalidate,
    }),
    setRole: useMutation({
      mutationFn: (v: { member: OrganizationMember; role: OrgRole }) => setMemberRole(v.member, v.role),
      onSuccess: invalidate,
    }),
    removeMember: useMutation({
      mutationFn: (v: { member: OrganizationMember }) => removeMember(v.member),
      onSuccess: invalidate,
    }),
    announce: useMutation({
      mutationFn: (v: { title: string; body: string; visibility: OrgAnnouncementVisibility }) =>
        postAnnouncement({ orgId: orgId!, authorId: requireUser(), ...v }),
      onSuccess: invalidate,
    }),
    startOrgConversation: useMutation({
      mutationFn: (v: { orgId: string; initialMessage?: string }) =>
        getOrCreateOrgConversation({ orgId: v.orgId, userId: requireUser(), initialMessage: v.initialMessage }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["org-inbox", orgId] });
        qc.invalidateQueries({ queryKey: ["conversations", userId] });
      },
    }),
    sendOrgMessage: useMutation({
      mutationFn: (v: { conversationId: string; body: string }) =>
        sendOrgInboxMessage(v.conversationId, requireUser(), v.body),
      onSuccess: (_msg, vars) => {
        qc.invalidateQueries({ queryKey: ["org-inbox", orgId] });
        qc.invalidateQueries({ queryKey: ["org-inbox-messages", vars.conversationId] });
      },
    }),
  };
}
