import { CheckCircle2, Circle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatEventDate } from "@/lib/helpers";
import type { CheckinSummaryResponse } from "@/lib/checkin";

interface CheckinRosterProps {
  summary?: CheckinSummaryResponse;
  isLoading?: boolean;
}

// Live counts (total / checked-in / remaining) with a progress bar, plus the
// full roster. Refetched after each successful scan by the parent.
export function CheckinRoster({ summary, isLoading }: CheckinRosterProps) {
  if (isLoading && !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const total = summary?.total ?? 0;
  const checkedIn = summary?.checked_in ?? 0;
  const remaining = summary?.remaining ?? 0;
  const pct = total > 0 ? Math.min(100, (checkedIn / total) * 100) : 0;
  const tickets = summary?.tickets ?? [];

  return (
    <div className="space-y-4">
      {/* Counts */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-heading text-2xl font-extrabold">{total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="font-heading text-2xl font-extrabold text-green">{checkedIn}</p>
            <p className="text-xs text-muted-foreground">Checked in</p>
          </div>
          <div>
            <p className="font-heading text-2xl font-extrabold text-primary">{remaining}</p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
        </div>
        <Progress value={pct} className="mt-4 h-2" />
      </div>

      {/* Roster */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3 text-sm font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          Guest list
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </span>
        </div>

        {tickets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No tickets issued for this event yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tickets.map((t) => {
              const used = t.status === "used";
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  {used ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-medium", used && "text-muted-foreground")}>
                      {t.holder_name ?? "Guest"}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {t.ticket_number}
                      {t.tier_name ? ` · ${t.tier_name}` : ""}
                    </p>
                  </div>
                  {used ? (
                    <Badge variant="outline" className="shrink-0 border-green/30 bg-green/10 text-green">
                      {t.used_at ? formatEventDate(t.used_at, { withYear: false }) : "In"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-muted-foreground">
                      Not in
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
