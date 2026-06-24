import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  fetchConnectStatus,
  startConnectOnboarding,
  type ConnectStatusResponse,
} from "@/lib/stripeConnect";

// The signed-in creator's Stripe Connect status (live-synced via the backend).
export function useConnectStatus() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<ConnectStatusResponse>({
    queryKey: ["connect-status", userId],
    enabled: !!userId,
    queryFn: fetchConnectStatus,
    staleTime: 15_000,
  });
}

// Kick off Stripe-hosted onboarding and redirect the browser into it.
export function useConnectOnboarding() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (): Promise<{ url: string | null; message?: string | null }> => {
      return startConnectOnboarding(window.location.origin);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["connect-status", userId] });
      if (res.url) window.location.href = res.url;
    },
  });
}
