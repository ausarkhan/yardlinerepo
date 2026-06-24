import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { submitReport, myReports, type SubmitReportInput } from "@/lib/reports";

export function useSubmitReport() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SubmitReportInput, "reporterId">) => {
      if (!me) throw new Error("Please sign in to submit a report.");
      return submitReport({ ...input, reporterId: me });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-reports", me] }),
  });
}

export function useMyReports() {
  const me = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["my-reports", me],
    enabled: !!me,
    queryFn: () => myReports(me!),
  });
}
