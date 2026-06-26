import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetRequestForm } from "@/components/budget/BudgetRequestForm";
import { useBudgetRequest, useBudgetRequestActions } from "@/hooks/useBudgetRequests";
import { useMyMemberships } from "@/hooks/useOrganizations";
import { canManageBudget } from "@/lib/organizations";
import { toast } from "sonner";

export default function NewBudgetRequest() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("edit") ?? undefined;
  const memberships = useMyMemberships();
  const detail = useBudgetRequest(editId);
  const orgs = useMemo(
    () => (memberships.data ?? []).filter((m) => canManageBudget(m.role)).map((m) => m.organization).filter(Boolean),
    [memberships.data],
  );
  const actions = useBudgetRequestActions(editId, params.get("org") ?? detail.data?.request.organization_id ?? undefined);

  return (
    <div className="container max-w-4xl py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/budget-requests">
          <ArrowLeft className="h-4 w-4" />
          Budget requests
        </Link>
      </Button>
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">{editId ? "Edit budget request" : "New budget request"}</h1>
          <p className="text-sm text-muted-foreground">Create a draft, add line items, then submit it for review.</p>
        </div>
      </header>
      {memberships.isLoading || (editId && detail.isLoading) ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : (
        <BudgetRequestForm
          organizations={orgs as NonNullable<(typeof orgs)[number]>[]}
          initialRequest={detail.data?.request}
          initialLineItems={detail.data?.lineItems}
          defaultOrgId={params.get("org")}
          pending={actions.create.isPending || actions.update.isPending}
          onSubmit={(input, lineItems) =>
            editId
              ? actions.update.mutate(
                  { id: editId, input, lineItems },
                  {
                    onSuccess: () => {
                      toast.success("Budget request updated.");
                      navigate(`/budget-requests/${editId}`);
                    },
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to save request."),
                  },
                )
              : actions.create.mutate(
                  { input, lineItems },
                  {
                    onSuccess: (request) => {
                      toast.success("Budget request saved.");
                      navigate(`/budget-requests/${request.id}`);
                    },
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to save request."),
                  },
                )
          }
        />
      )}
    </div>
  );
}
