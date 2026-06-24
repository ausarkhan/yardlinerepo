import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, ExternalLink, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { ModerationActionDialog } from "./ModerationActionDialog";
import { useAdminReports, useModerationActions } from "@/hooks/useAdmin";
import { REPORT_CATEGORIES, REPORT_TARGET_LABELS } from "@/lib/reports";
import type { Report, ReportStatus, ReportTargetType } from "@/lib/types";
import { formatRelativeTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Deep link to the reported entity so the moderator can inspect it.
function targetLink(type: string, id: string): string | null {
  switch (type) {
    case "event":
      return `/event/${id}`;
    case "provider":
      return `/provider/${id}`;
    default:
      return null;
  }
}

export function AdminReportsQueue() {
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const { data: reports, isLoading } = useAdminReports(filter === "all" ? undefined : filter);
  const { resolveReport } = useModerationActions();
  const [pending, setPending] = useState<{ report: Report; outcome: "actioned" | "dismissed" } | null>(null);

  const categoryLabel = (v: string) => REPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

  const onConfirm = (reason: string) => {
    if (!pending) return;
    resolveReport.mutate(
      { report: pending.report, outcome: pending.outcome, reason },
      {
        onSuccess: () => {
          toast.success(pending.outcome === "actioned" ? "Report actioned." : "Report dismissed.");
          setPending(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as ReportStatus | "all")}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="actioned">Actioned</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (reports ?? []).length === 0 ? (
        <EmptyState icon={Flag} title="Nothing here" description="No reports in this view." />
      ) : (
        <ul className="space-y-3">
          {(reports ?? []).map((r) => {
            const link = targetLink(r.target_type, r.target_id);
            const open = r.status === "open";
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="border-0">
                        {REPORT_TARGET_LABELS[r.target_type as ReportTargetType] ?? r.target_type}
                      </Badge>
                      <span className="font-semibold">{categoryLabel(r.category)}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          r.status === "actioned" && "border-green/30 bg-green/10 text-green",
                          r.status === "dismissed" && "border-border bg-muted text-muted-foreground",
                          r.status === "open" && "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        {r.status}
                      </Badge>
                    </div>
                    {r.details ? <p className="mt-2 text-sm text-muted-foreground">{r.details}</p> : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Reported {formatRelativeTime(r.created_at)}
                      {link ? (
                        <>
                          {" · "}
                          <Link to={link} className="inline-flex items-center gap-1 text-primary hover:underline">
                            View target <ExternalLink className="h-3 w-3" />
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {r.resolution ? (
                      <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">Resolution: {r.resolution}</p>
                    ) : null}
                  </div>

                  {open ? (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPending({ report: r, outcome: "dismissed" })}>
                        <X className="h-3.5 w-3.5" /> Dismiss
                      </Button>
                      <Button size="sm" onClick={() => setPending({ report: r, outcome: "actioned" })}>
                        <Check className="h-3.5 w-3.5" /> Action
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ModerationActionDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.outcome === "actioned" ? "Action this report" : "Dismiss this report"}
        description={
          pending?.outcome === "actioned"
            ? "Mark the report as actioned. Note what moderation you took — the reporter is notified."
            : "Dismiss without action. The reporter is notified that no action was taken."
        }
        confirmLabel={pending?.outcome === "actioned" ? "Mark actioned" : "Dismiss"}
        destructive={pending?.outcome === "dismissed"}
        pending={resolveReport.isPending}
        onConfirm={onConfirm}
      />
    </div>
  );
}
