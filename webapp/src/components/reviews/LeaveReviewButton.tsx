import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewFormDialog } from "./ReviewFormDialog";
import { useCanReviewProvider, useCanReviewEvent } from "@/hooks/useReviewSystem";
import type { ReviewTargetType } from "@/lib/reviews";

interface LeaveReviewButtonProps {
  targetType: ReviewTargetType;
  targetId: string; // reviews key: provider ROW id, or event id
  targetName?: string | null;
  targetAvatar?: string | null;
  // Eligibility inputs: provider needs the provider's USER id; event needs the event id.
  providerUserId?: string | null;
  eventId?: string | null;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
}

// Renders a review CTA only when the signed-in user is ELIGIBLE:
//   provider → has a completed booking with them
//   event    → holds a used ticket for the event
export function LeaveReviewButton({
  targetType,
  targetId,
  targetName,
  targetAvatar,
  providerUserId,
  eventId,
  size = "sm",
  variant = "outline",
}: LeaveReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const providerEligible = useCanReviewProvider(
    targetType === "provider" ? providerUserId ?? undefined : undefined,
  );
  const eventEligible = useCanReviewEvent(targetType === "event" ? eventId ?? undefined : undefined);

  const eligible = targetType === "provider" ? providerEligible.data : eventEligible.data;
  if (!eligible) return null;

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Star className="h-4 w-4" />
        Leave a review
      </Button>
      <ReviewFormDialog
        open={open}
        onOpenChange={setOpen}
        targetType={targetType}
        targetId={targetId}
        targetName={targetName}
        targetAvatar={targetAvatar}
      />
    </>
  );
}
