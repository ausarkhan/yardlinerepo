import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminBudgetRequests as AdminBudgetRequestsPanel } from "@/components/admin/AdminBudgetRequests";

export default function AdminBudgetRequests() {
  return (
    <AdminGuard>
      <div className="container max-w-6xl py-8 md:py-12">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/admin?tab=budget">
            <ArrowLeft className="h-4 w-4" />
            Admin dashboard
          </Link>
        </Button>
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Admin budget requests</h1>
            <p className="text-sm text-muted-foreground">Campus funding review and finance export workflow.</p>
          </div>
        </header>
        <AdminBudgetRequestsPanel />
      </div>
    </AdminGuard>
  );
}
