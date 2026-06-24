import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Flag, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ReportDialog } from "@/components/reports/ReportDialog";
import { useMyReports } from "@/hooks/useReports";
import { REPORT_CATEGORIES, REPORT_TARGET_LABELS } from "@/lib/reports";
import type { ReportTargetType } from "@/lib/types";
import { formatEventDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

const VALID_TARGETS: ReportTargetType[] = ["event", "provider", "user", "message"];

function statusStyle(status: string): string {
  switch (status) {
    case "actioned":
      return "bg-green/15 text-green border-green/30";
    case "dismissed":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
}

export default function Report() {
  const [params] = useSearchParams();
  const paramType = params.get("type");
  const paramId = params.get("id");
  const prefillType = VALID_TARGETS.includes(paramType as ReportTargetType)
    ? (paramType as ReportTargetType)
    : null;

  const [open, setOpen] = useState(Boolean(prefillType && paramId));
  const { data: reports, isLoading } = useMyReports();

  const categoryLabel = (v: string) => REPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

  return (
    <div className="container max-w-2xl py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Report a problem</h1>
          <p className="text-sm text-muted-foreground">
            Flag content or behavior that breaks YardLine's community standards.
          </p>
        </div>
      </header>

      {prefillType && paramId ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm">
            Reporting a <span className="font-semibold">{REPORT_TARGET_LABELS[prefillType].toLowerCase()}</span>.
          </p>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <Flag className="h-4 w-4" />
            Continue report
          </Button>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          To report something specific, use the <span className="font-medium text-foreground">Report</span> button on a
          provider, event, user, or message. Your submitted reports appear below.
        </div>
      )}

      <h2 className="mb-3 font-heading text-lg font-bold">Your reports</h2>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : (reports ?? []).length === 0 ? (
        <EmptyState icon={Flag} title="No reports submitted" description="Anything you report will show up here." />
      ) : (
        <ul className="space-y-3">
          {(reports ?? []).map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {REPORT_TARGET_LABELS[(r.target_type as ReportTargetType)] ?? r.target_type} ·{" "}
                  {categoryLabel(r.category)}
                </p>
                <Badge variant="outline" className={cn("border capitalize", statusStyle(r.status))}>
                  {r.status}
                </Badge>
              </div>
              {r.details ? <p className="mt-1 text-sm text-muted-foreground">{r.details}</p> : null}
              <p className="mt-2 text-xs text-muted-foreground">Submitted {formatEventDate(r.created_at, { withYear: true })}</p>
              {r.resolution ? (
                <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">Moderator: {r.resolution}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {prefillType && paramId ? (
        <ReportDialog open={open} onOpenChange={setOpen} targetType={prefillType} targetId={paramId} />
      ) : null}
    </div>
  );
}
