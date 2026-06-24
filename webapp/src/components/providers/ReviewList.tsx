import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/common/StarRating";
import { EmptyState } from "@/components/common/EmptyState";
import type { Review } from "@/lib/types";
import { avatarUrl, initials, formatEventDate } from "@/lib/helpers";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No reviews yet"
        description="Be the first to work with this provider and leave a review."
      />
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl(r.reviewer_avatar)} alt={r.reviewer_name ?? ""} />
              <AvatarFallback className="bg-muted text-xs font-semibold">
                {initials(r.reviewer_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold">{r.reviewer_name ?? "Member"}</p>
              {r.created_at ? (
                <p className="text-xs text-muted-foreground">{formatEventDate(r.created_at)}</p>
              ) : null}
            </div>
            <StarRating value={r.score ?? 0} size={14} />
          </div>
          {r.message ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.message}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
