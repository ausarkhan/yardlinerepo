import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  addBudgetComment,
  createBudgetRequest,
  getBudgetRequest,
  listBudgetRequests,
  listOrgBudgetRequests,
  transitionBudgetRequest,
  updateBudgetRequest,
  uploadBudgetAttachment,
  type BudgetLineItemInput,
  type BudgetRequestInput,
} from "@/lib/budgetRequests";
import type { BudgetRequestStatus } from "@/lib/types";

export function useBudgetRequests(opts?: {
  organizationId?: string;
  status?: string;
  category?: string;
  neededByBefore?: string;
  admin?: boolean;
}) {
  return useQuery({
    queryKey: ["budget-requests", opts],
    queryFn: () => listBudgetRequests(opts),
  });
}

export function useOrgBudgetRequests(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-budget-requests", orgId],
    enabled: !!orgId,
    queryFn: () => listOrgBudgetRequests(orgId!),
  });
}

export function useBudgetRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["budget-request", id],
    enabled: !!id,
    queryFn: () => getBudgetRequest(id!),
  });
}

export function useBudgetRequestActions(requestId?: string, orgId?: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budget-requests"] });
    qc.invalidateQueries({ queryKey: ["org-budget-requests", orgId] });
    qc.invalidateQueries({ queryKey: ["budget-request", requestId] });
    qc.invalidateQueries({ queryKey: ["org-activity", orgId] });
  };
  const requireUser = () => {
    if (!userId) throw new Error("Please sign in.");
    return userId;
  };

  return {
    create: useMutation({
      mutationFn: (v: { input: BudgetRequestInput; lineItems: BudgetLineItemInput[] }) =>
        createBudgetRequest(v.input, v.lineItems, requireUser()),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: BudgetRequestInput; lineItems: BudgetLineItemInput[] }) =>
        updateBudgetRequest(v.id, v.input, v.lineItems),
      onSuccess: invalidate,
    }),
    transition: useMutation({
      mutationFn: (v: {
        id: string;
        status: BudgetRequestStatus;
        reason?: string;
        amountApprovedCents?: number | null;
        adminNotes?: string | null;
      }) => transitionBudgetRequest(v),
      onSuccess: invalidate,
    }),
    comment: useMutation({
      mutationFn: (v: { requestId: string; body: string; visibility?: "organization" | "advisor_admin" | "admin" }) =>
        addBudgetComment({ requestId: v.requestId, body: v.body, visibility: v.visibility, actorId: requireUser() }),
      onSuccess: invalidate,
    }),
    upload: useMutation({
      mutationFn: (v: { requestId: string; file: File; documentType?: string }) =>
        uploadBudgetAttachment({ requestId: v.requestId, file: v.file, documentType: v.documentType, userId: requireUser() }),
      onSuccess: invalidate,
    }),
  };
}
