import { Link } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetRequestList } from "@/components/budget/BudgetRequestList";
import { useBudgetRequests } from "@/hooks/useBudgetRequests";

export default function BudgetRequests() {
  const requests = useBudgetRequests();
  return (
    <div className="container max-w-5xl py-8 md:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Budget requests</h1>
            <p className="text-sm text-muted-foreground">Track campus funding requests and finance handoff status.</p>
          </div>
        </div>
        <Button asChild>
          <Link to="/budget-requests/new">
            <Plus className="h-4 w-4" />
            New
          </Link>
        </Button>
      </header>
      <BudgetRequestList requests={requests.data} isLoading={requests.isLoading} emptyActionTo="/budget-requests/new" />
    </div>
  );
}
