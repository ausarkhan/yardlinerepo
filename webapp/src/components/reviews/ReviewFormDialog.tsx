import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RatingInput } from "./RatingInput";
import { useCreateReview } from "@/hooks/useReviewSystem";
import type { ReviewTargetType } from "@/lib/reviews";
import { toast } from "sonner";

interface ReviewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReviewTargetType;
  targetId: string;
  targetName?: string | null;
  targetAvatar?: string | null;
}

export function ReviewFormDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetName,
  targetAvatar,
}: ReviewFormDialogProps) {
  const create = useCreateReview();
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("");

  const reset = () => {
    setScore(0);
    setMessage("");
  };

  const onSubmit = () => {
    if (score < 1) {
      toast.error("Please choose a rating from 1 to 10.");
      return;
    }
    create.mutate(
      { targetType, targetId, targetName, targetAvatar, score, message },
      {
        onSuccess: () => {
          toast.success("Thanks for your review!");
          reset();
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't submit review."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            Review {targetName ?? (targetType === "event" ? "this event" : "this provider")}
          </DialogTitle>
          <DialogDescription>
            Rate your experience from 1 to 10 and share details to help other students.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Your rating</Label>
            <RatingInput value={score} onChange={setScore} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-message">Your review</Label>
            <Textarea
              id="review-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What stood out? Would you recommend them?"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={create.isPending || score < 1}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
