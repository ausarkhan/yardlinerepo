import { useState } from "react";
import { Check, CircleDollarSign, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBudgetRequestActions } from "@/hooks/useBudgetRequests";
import type { BudgetRequest, BudgetRequestStatus } from "@/lib/types";
import { toast } from "sonner";

export function BudgetDecisionPanel({ request, admin = false }: { request: BudgetRequest; admin?: boolean }) {
  const actions = useBudgetRequestActions(request.id, request.organization_id);
  const [reason, setReason] = useState("");
  const [approved, setApproved] = useState(((request.amount_approved_cents ?? request.amount_requested_cents) / 100).toFixed(2));

  const decide = (status: BudgetRequestStatus) => {
    const needsReason = status === "denied" || status === "changes_requested";
    if (needsReason && !reason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    actions.transition.mutate(
      {
        id: request.id,
        status,
        reason,
        amountApprovedCents:
          status === "approved" || status === "partially_approved" ? Math.round(Number(approved || 0) * 100) : undefined,
        adminNotes: admin ? reason : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Budget request updated.");
          setReason("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
      },
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-heading text-lg font-bold">{admin ? "Admin review" : "Workflow actions"}</h2>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason, notes, or finance handoff details"
      />
      <div className="flex max-w-xs items-center gap-2">
        <span className="text-sm text-muted-foreground">$</span>
        <Input value={approved} onChange={(e) => setApproved(e.target.value)} inputMode="decimal" />
      </div>
      <div className="flex flex-wrap gap-2">
        {request.status === "draft" || request.status === "changes_requested" ? (
          <Button size="sm" onClick={() => decide("advisor_review")} disabled={actions.transition.isPending}>
            <Send className="h-4 w-4" />
            Submit
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => decide("admin_review")} disabled={actions.transition.isPending}>
          <Send className="h-4 w-4" />
          Send to admin
        </Button>
        <Button size="sm" onClick={() => decide("approved")} disabled={actions.transition.isPending}>
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => decide("partially_approved")} disabled={actions.transition.isPending}>
          <CircleDollarSign className="h-4 w-4" />
          Partial
        </Button>
        <Button size="sm" variant="outline" onClick={() => decide("changes_requested")} disabled={actions.transition.isPending}>
          Changes
        </Button>
        <Button size="sm" variant="destructive" onClick={() => decide("denied")} disabled={actions.transition.isPending}>
          <X className="h-4 w-4" />
          Deny
        </Button>
        {admin ? (
          <>
            <Button size="sm" variant="outline" onClick={() => decide("paid")} disabled={actions.transition.isPending}>
              Mark paid
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide("closed")} disabled={actions.transition.isPending}>
              Close
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
