import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetRequestList } from "./BudgetRequestList";
import { BudgetSummaryCards } from "./BudgetSummaryCards";
import { useOrgBudgetRequests } from "@/hooks/useBudgetRequests";

export function OrgBudgetPanel({ orgId, canCreate }: { orgId: string; canCreate: boolean }) {
  const requests = useOrgBudgetRequests(orgId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold">Budget requests</h2>
        {canCreate ? (
          <Button asChild size="sm">
            <Link to={`/budget-requests/new?org=${orgId}`}>
              <Plus className="h-4 w-4" />
              Create budget request
            </Link>
          </Button>
        ) : null}
      </div>
      <BudgetSummaryCards requests={requests.data ?? []} />
      <BudgetRequestList
        requests={requests.data}
        isLoading={requests.isLoading}
        emptyActionTo={canCreate ? `/budget-requests/new?org=${orgId}` : undefined}
      />
    </div>
  );
}
