import { Badge } from "@/components/ui/badge";
import { budgetStatusLabel } from "@/lib/budgetRequests";
import { cn } from "@/lib/utils";

export function BudgetStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "draft" && "border-border bg-muted text-muted-foreground",
        ["submitted", "advisor_review", "admin_review", "changes_requested"].includes(status) &&
          "border-primary/30 bg-primary/10 text-primary",
        ["approved", "partially_approved", "paid"].includes(status) &&
          "border-green/30 bg-green/10 text-green",
        ["denied", "cancelled"].includes(status) && "border-destructive/30 bg-destructive/10 text-destructive",
        status === "closed" && "border-border bg-card text-muted-foreground",
      )}
    >
      {budgetStatusLabel(status)}
    </Badge>
  );
}
