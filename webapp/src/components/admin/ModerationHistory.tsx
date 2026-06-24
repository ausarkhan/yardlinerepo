import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useModerationHistory } from "@/hooks/useAdmin";
import { formatRelativeTime, titleCase } from "@/lib/helpers";

// Read-only audit trail of every moderation action taken (never deleted).
export function ModerationHistory() {
  const { data, isLoading } = useModerationHistory();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if ((data ?? []).length === 0) {
    return <EmptyState icon={History} title="No moderation history" description="Actions you take will be logged here." />;
  }

  return (
    <ul className="space-y-2">
      {(data ?? []).map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Badge variant="secondary" className="border-0">
                {titleCase(a.action)}
              </Badge>
              <span className="text-muted-foreground">{a.target_type}</span>
            </p>
            {a.reason ? <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p> : null}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(a.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
