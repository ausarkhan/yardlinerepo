import { Link } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { BudgetStatusBadge } from "./BudgetStatusBadge";
import { budgetCategoryLabel } from "@/lib/budgetRequests";
import { formatDollars, formatEventDate, formatRelativeTime } from "@/lib/helpers";
import type { BudgetRequest } from "@/lib/types";

interface Props {
  requests: BudgetRequest[] | undefined;
  isLoading?: boolean;
  emptyActionTo?: string;
}

export function BudgetRequestList({ requests, isLoading, emptyActionTo }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No budget requests"
        description="Funding requests and their approval status will appear here."
        action={
          emptyActionTo ? (
            <Button asChild>
              <Link to={emptyActionTo}>
                <Plus className="h-4 w-4" />
                New request
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <li key={request.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/budget-requests/${request.id}`} className="font-semibold hover:underline">
                  {request.title}
                </Link>
                <BudgetStatusBadge status={request.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {budgetCategoryLabel(request.category)}
                {request.needed_by_date ? ` · needed by ${formatEventDate(request.needed_by_date, { withYear: true })}` : ""}
              </p>
              {request.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{request.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">Created {formatRelativeTime(request.created_at)}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg font-bold">{formatDollars((request.amount_requested_cents ?? 0) / 100)}</div>
              <div className="text-xs text-muted-foreground">
                Approved {formatDollars((request.amount_approved_cents ?? 0) / 100)}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
