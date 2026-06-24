import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  reviewSummary,
  canReviewProvider,
  canReviewEvent,
  createReview,
  type CreateReviewInput,
} from "@/lib/reviews";

export function useReviewSummary(targetId: string | undefined) {
  return useQuery({
    queryKey: ["review-summary", targetId],
    enabled: !!targetId,
    queryFn: () => reviewSummary(targetId),
  });
}

// Can the signed-in user review this provider? providerUserId = bookings.provider_id.
export function useCanReviewProvider(providerUserId: string | undefined) {
  const me = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["can-review-provider", me, providerUserId],
    enabled: !!me && !!providerUserId,
    queryFn: () => canReviewProvider(me!, providerUserId!),
  });
}

export function useCanReviewEvent(eventId: string | undefined) {
  const me = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["can-review-event", me, eventId],
    enabled: !!me && !!eventId,
    queryFn: () => canReviewEvent(me!, eventId!),
  });
}

export function useCreateReview() {
  const profile = useAuthStore((s) => s.profile);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => {
      if (!profile) throw new Error("Please sign in to leave a review.");
      return createReview(input, profile);
    },
    onSuccess: (_review, input) => {
      qc.invalidateQueries({ queryKey: ["reviews", input.targetId] });
      qc.invalidateQueries({ queryKey: ["review-summary", input.targetId] });
      qc.invalidateQueries({ queryKey: ["reputation"] });
    },
  });
}
