import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, MessageSquare, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BudgetDecisionPanel } from "@/components/budget/BudgetDecisionPanel";
import { BudgetStatusBadge } from "@/components/budget/BudgetStatusBadge";
import { useBudgetRequest, useBudgetRequestActions } from "@/hooks/useBudgetRequests";
import { budgetCategoryLabel, signedAttachmentUrl } from "@/lib/budgetRequests";
import { formatDollars, formatEventDate, formatRelativeTime } from "@/lib/helpers";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";

export default function BudgetRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user?.id);
  const detail = useBudgetRequest(id);
  const actions = useBudgetRequestActions(id, detail.data?.request.organization_id);
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);

  if (detail.isLoading) {
    return (
      <div className="container max-w-5xl py-12">
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (!detail.data) {
    return (
      <div className="container max-w-2xl py-20">
        <Button onClick={() => navigate("/budget-requests")}>Back to budget requests</Button>
      </div>
    );
  }

  const { request, organization, lineItems, attachments, comments, decisions } = detail.data;
  const editable = request.status === "draft" || request.status === "changes_requested";

  return (
    <div className="container max-w-5xl py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/budget-requests">
          <ArrowLeft className="h-4 w-4" />
          Budget requests
        </Link>
      </Button>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl font-extrabold">{request.title}</h1>
            <BudgetStatusBadge status={request.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {organization?.name ?? "Organization"} · {budgetCategoryLabel(request.category)}
          </p>
        </div>
        {editable ? (
          <Button asChild variant="outline">
            <Link to={`/budget-requests/new?edit=${request.id}&org=${request.organization_id}`}>Edit draft</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <main className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">Request</h2>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Requested</span>
                <div className="font-semibold">{formatDollars(request.amount_requested_cents / 100)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Approved</span>
                <div className="font-semibold">{formatDollars((request.amount_approved_cents ?? 0) / 100)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Needed by</span>
                <div className="font-semibold">{request.needed_by_date ? formatEventDate(request.needed_by_date, { withYear: true }) : "Not set"}</div>
              </div>
            </div>
            {request.description ? <p className="mt-4 text-sm text-muted-foreground">{request.description}</p> : null}
            {request.purpose ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm">{request.purpose}</p> : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">Line items</h2>
            <div className="space-y-2">
              {lineItems.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-xl border border-border p-3 text-sm md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="font-semibold">{item.item_name}</div>
                    <div className="text-muted-foreground">{item.description || item.vendor || "No details"}</div>
                  </div>
                  <div className="text-right font-semibold">{formatDollars(item.total_cost_cents / 100)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">Documents</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button
                type="button"
                disabled={!file || actions.upload.isPending}
                onClick={() =>
                  file &&
                  actions.upload.mutate(
                    { requestId: request.id, file },
                    {
                      onSuccess: () => {
                        toast.success("Document uploaded.");
                        setFile(null);
                      },
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed."),
                    },
                  )
                }
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </div>
            <ul className="space-y-2">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {attachment.file_name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => window.open(await signedAttachmentUrl(attachment.file_path), "_blank")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold">
              <MessageSquare className="h-4 w-4" /> Comments
            </h2>
            <div className="mb-3 space-y-2">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" />
              <Button
                disabled={!comment.trim() || !me || actions.comment.isPending}
                onClick={() =>
                  actions.comment.mutate(
                    { requestId: request.id, body: comment },
                    {
                      onSuccess: () => {
                        toast.success("Comment added.");
                        setComment("");
                      },
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Comment failed."),
                    },
                  )
                }
              >
                Add comment
              </Button>
            </div>
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-xl bg-muted p-3 text-sm">
                  <p>{c.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(c.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <aside className="space-y-4">
          <BudgetDecisionPanel request={request} />
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-heading text-lg font-bold">Decision history</h2>
            <ul className="space-y-2">
              {decisions.map((d) => (
                <li key={d.id} className="rounded-xl bg-muted p-3 text-sm">
                  <div className="font-medium">{d.previous_status ?? "created"} → {d.new_status}</div>
                  {d.reason ? <p className="text-muted-foreground">{d.reason}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(d.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
