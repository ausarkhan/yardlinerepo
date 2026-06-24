import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  getAcceptances,
  outstandingDocuments,
  hasAcceptedAll,
  acceptDocuments,
} from "@/lib/waivers";
import type { LegalDocument } from "@/lib/types";

// Tracks whether the signed-in user has accepted all required legal documents at
// their current versions. Used by the LegalGate before gated actions.
export function useWaiver() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["waiver-acceptances", me],
    enabled: !!me,
    queryFn: () => getAcceptances(me!),
  });

  const rows = query.data ?? [];
  const outstanding = outstandingDocuments(rows);
  const accepted = me ? hasAcceptedAll(rows) : false;

  const accept = useMutation({
    mutationFn: (documents: LegalDocument[]) => {
      if (!me) throw new Error("Please sign in first.");
      return acceptDocuments(me, documents);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waiver-acceptances", me] }),
  });

  return { query, rows, outstanding, accepted, accept };
}
