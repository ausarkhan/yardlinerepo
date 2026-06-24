import { useQuery } from "@tanstack/react-query";
import { providerReputation, hostReputation } from "@/lib/reputation";

export function useProviderReputation(
  providerRowId: string | undefined,
  providerUserId: string | null | undefined,
) {
  return useQuery({
    queryKey: ["reputation", "provider", providerRowId],
    enabled: !!providerRowId,
    queryFn: () => providerReputation(providerRowId!, providerUserId ?? null),
  });
}

export function useHostReputation(hostUserId: string | undefined) {
  return useQuery({
    queryKey: ["reputation", "host", hostUserId],
    enabled: !!hostUserId,
    queryFn: () => hostReputation(hostUserId!),
  });
}
