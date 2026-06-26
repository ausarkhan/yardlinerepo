import { CheckCircle2, Clock3, DollarSign, FileText, XCircle } from "lucide-react";
import { summarizeBudgetRequests } from "@/lib/budgetRequests";
import { formatDollars } from "@/lib/helpers";
import type { BudgetRequest } from "@/lib/types";

export function BudgetSummaryCards({ requests, admin = false }: { requests: BudgetRequest[]; admin?: boolean }) {
  const s = summarizeBudgetRequests(requests);
  const cards = admin
    ? [
        ["Advisor review", s.advisor_review, Clock3],
        ["Admin review", s.admin_review, FileText],
        ["Approved", s.approved, CheckCircle2],
        ["Partial", s.partially_approved, CheckCircle2],
        ["Paid", s.paid, DollarSign],
        ["Denied", s.denied, XCircle],
        ["Requested", formatDollars(s.totalRequested / 100), DollarSign],
        ["Approved total", formatDollars(s.totalApproved / 100), DollarSign],
      ]
    : [
        ["Draft", s.draft, FileText],
        ["Submitted", s.submitted + s.advisor_review + s.admin_review, Clock3],
        ["Approved", s.approved + s.partially_approved, CheckCircle2],
        ["Denied", s.denied, XCircle],
        ["Paid", s.paid, DollarSign],
        ["Requested", formatDollars(s.totalRequested / 100), DollarSign],
        ["Approved total", formatDollars(s.totalApproved / 100), DollarSign],
        ["Paid total", formatDollars(s.totalPaid / 100), DollarSign],
      ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value, Icon]) => (
        <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{label}</span>
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      ))}
    </div>
  );
}
