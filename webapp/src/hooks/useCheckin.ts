import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCheckinSummary,
  scanTicket,
  type CheckinScanRequest,
  type CheckinScanResponse,
  type CheckinSummaryResponse,
} from "@/lib/checkin";

const summaryKey = (eventId: string | undefined) => ["checkin-summary", eventId];

// Live roster + counts for the host's event (host-gated, auth token attached).
export function useCheckinSummary(eventId: string | undefined, enabled: boolean = true) {
  return useQuery<CheckinSummaryResponse>({
    queryKey: summaryKey(eventId),
    enabled: !!eventId && enabled,
    queryFn: () => fetchCheckinSummary(eventId as string),
    staleTime: 5_000,
  });
}

// Scan / manually enter a ticket, then refresh the roster on a successful admit.
export function useScanTicket(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<CheckinScanResponse, Error, CheckinScanRequest>({
    mutationFn: (body) => scanTicket(body),
    onSuccess: (res) => {
      // Only a brand-new admit changes the counts, but it's cheap + safe to
      // refetch on already_used too (used_at may now be visible).
      if (res.result === "ok" || res.result === "already_used") {
        qc.invalidateQueries({ queryKey: summaryKey(eventId) });
      }
    },
  });
}
