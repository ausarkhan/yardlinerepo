import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  isAdmin,
  platformMetrics,
  adminListUsers,
  adminListEvents,
  adminListProviders,
  adminListOrganizations,
  adminListReports,
  listModerationHistory,
  suspendUser,
  reinstateUser,
  setEventHidden,
  setProviderHidden,
  setOrganizationStatus,
  assignOrganizationAdvisor,
  resolveReport,
} from "@/lib/admin";
import type { OrgStatus, Report } from "@/lib/types";

export function useIsAdmin(): boolean {
  const profile = useAuthStore((s) => s.profile);
  return isAdmin(profile);
}

export function useAdminMetrics() {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ["admin-metrics"],
    enabled: admin,
    queryFn: platformMetrics,
  });
}

export function useAdminUsers(page = 0, search = "") {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ["admin-users", page, search],
    enabled: admin,
    queryFn: () => adminListUsers(page, search),
  });
}

export function useAdminEvents(page = 0) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ["admin-events", page],
    enabled: admin,
    queryFn: () => adminListEvents(page),
  });
}

export function useAdminProviders(page = 0) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ["admin-providers", page],
    enabled: admin,
    queryFn: () => adminListProviders(page),
  });
}

export function useAdminOrganizations(page = 0) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ["admin-organizations", page],
    enabled: admin,
    queryFn: () => adminListOrganizations(page),
  });
}

export function useAdminReports(status?: Report["status"]) {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ["admin-reports", status ?? "all"],
    enabled: admin,
    queryFn: () => adminListReports(status),
  });
}

export function useModerationHistory() {
  const admin = useIsAdmin();
  return useQuery({
    queryKey: ["moderation-history"],
    enabled: admin,
    queryFn: listModerationHistory,
  });
}

// All moderation mutations share an invalidation sweep so every admin view stays
// fresh after an action.
export function useModerationActions() {
  const adminId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const invalidate = () => {
    [
      "admin-users",
      "admin-events",
      "admin-providers",
      "admin-organizations",
      "admin-reports",
      "admin-metrics",
      "moderation-history",
    ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const requireAdmin = () => {
    if (!adminId) throw new Error("Not authenticated");
    return adminId;
  };

  return {
    suspendUser: useMutation({
      mutationFn: (v: { userId: string; reason: string }) =>
        suspendUser(requireAdmin(), v.userId, v.reason),
      onSuccess: invalidate,
    }),
    reinstateUser: useMutation({
      mutationFn: (v: { userId: string; reason: string }) =>
        reinstateUser(requireAdmin(), v.userId, v.reason),
      onSuccess: invalidate,
    }),
    setEventHidden: useMutation({
      mutationFn: (v: { eventId: string; hidden: boolean; reason: string }) =>
        setEventHidden(requireAdmin(), v.eventId, v.hidden, v.reason),
      onSuccess: invalidate,
    }),
    setProviderHidden: useMutation({
      mutationFn: (v: { providerRowId: string; hidden: boolean; reason: string }) =>
        setProviderHidden(requireAdmin(), v.providerRowId, v.hidden, v.reason),
      onSuccess: invalidate,
    }),
    setOrganizationStatus: useMutation({
      mutationFn: (v: { organizationId: string; status: OrgStatus; reason: string }) =>
        setOrganizationStatus(requireAdmin(), v.organizationId, v.status, v.reason),
      onSuccess: invalidate,
    }),
    assignOrganizationAdvisor: useMutation({
      mutationFn: (v: { organizationId: string; advisorName: string; advisorEmail: string }) =>
        assignOrganizationAdvisor(requireAdmin(), v.organizationId, v.advisorName, v.advisorEmail),
      onSuccess: invalidate,
    }),
    resolveReport: useMutation({
      mutationFn: (v: { report: Report; outcome: "actioned" | "dismissed"; reason: string }) =>
        resolveReport(requireAdmin(), v.report, v.outcome, v.reason),
      onSuccess: invalidate,
    }),
  };
}
