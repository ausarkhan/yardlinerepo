import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgBudgetPanel } from "@/components/budget/OrgBudgetPanel";
import { useMyMemberships } from "@/hooks/useOrganizations";
import { canManageBudget } from "@/lib/organizations";

export default function OrgBudget() {
  const [params] = useSearchParams();
  const memberships = useMyMemberships();
  const selected = (memberships.data ?? []).find((m) => m.organization_id === params.get("org")) ?? memberships.data?.[0];
  return (
    <div className="container max-w-5xl py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/org-dashboard">
          <ArrowLeft className="h-4 w-4" />
          Org dashboard
        </Link>
      </Button>
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Organization budget</h1>
          <p className="text-sm text-muted-foreground">Draft, submit, and track funding requests.</p>
        </div>
      </header>
      {memberships.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : selected ? (
        <OrgBudgetPanel orgId={selected.organization_id} canCreate={canManageBudget(selected.role)} />
      ) : (
        <p className="text-sm text-muted-foreground">Join an organization to view budget requests.</p>
      )}
    </div>
  );
}
