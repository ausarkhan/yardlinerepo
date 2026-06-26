import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BudgetRequestList } from "@/components/budget/BudgetRequestList";
import { BudgetSummaryCards } from "@/components/budget/BudgetSummaryCards";
import {
  BUDGET_CATEGORIES,
  BUDGET_STATUSES,
  budgetRequestsToCsv,
  downloadCsv,
} from "@/lib/budgetRequests";
import { useBudgetRequests } from "@/hooks/useBudgetRequests";
import { useOrganizations } from "@/hooks/useOrganizations";

export function AdminBudgetRequests() {
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [orgId, setOrgId] = useState("all");
  const orgs = useOrganizations("", "all");
  const requests = useBudgetRequests({
    admin: true,
    status,
    category,
    organizationId: orgId === "all" ? undefined : orgId,
  });

  const orgMap = useMemo(() => {
    const map: Record<string, string> = {};
    (orgs.data ?? []).forEach((org) => (map[org.id] = org.name));
    return map;
  }, [orgs.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Budget requests</h2>
          <p className="text-sm text-muted-foreground">Review approvals and export finance handoff data.</p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(
              "budget-requests.csv",
              budgetRequestsToCsv((requests.data ?? []).map((request) => ({ request, organizationName: orgMap[request.organization_id] }))),
            )
          }
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BUDGET_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {BUDGET_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger>
            <SelectValue placeholder="Organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organizations</SelectItem>
            {(orgs.data ?? []).map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BudgetSummaryCards requests={requests.data ?? []} admin />
      <BudgetRequestList requests={requests.data} isLoading={requests.isLoading} />
    </div>
  );
}
