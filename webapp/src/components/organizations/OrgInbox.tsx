import { useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/EmptyState";
import { useOrgActions, useOrgInbox, useOrgInboxMessages } from "@/hooks/useOrganizations";
import { useAuthStore } from "@/store/auth";
import { avatarUrl, formatClockTime, formatRelativeTime, initials } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function OrgInbox({ orgId, canReply }: { orgId: string; canReply: boolean }) {
  const me = useAuthStore((s) => s.user?.id);
  const inbox = useOrgInbox(orgId, canReply);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const selected = useMemo(
    () => (inbox.data ?? []).find((c) => c.id === selectedId) ?? inbox.data?.[0],
    [inbox.data, selectedId],
  );
  const messages = useOrgInboxMessages(selected?.id, canReply);
  const { sendOrgMessage } = useOrgActions(orgId);

  useEffect(() => {
    if (!selectedId && inbox.data?.[0]) setSelectedId(inbox.data[0].id);
  }, [inbox.data, selectedId]);

  if (!canReply) {
    return <EmptyState icon={Inbox} title="Inbox unavailable" description="Only organization officers and advisors can view the shared inbox." />;
  }

  if (inbox.isLoading) {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }

  if ((inbox.data ?? []).length === 0) {
    return <EmptyState icon={Inbox} title="No organization messages" description="Questions and partnership requests will appear here." />;
  }

  const submit = () => {
    const body = draft.trim();
    if (!selected || !body) return;
    sendOrgMessage.mutate(
      { conversationId: selected.id, body },
      {
        onSuccess: () => {
          setDraft("");
          messages.refetch();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Message failed."),
      },
    );
  };

  return (
    <div className="grid min-h-[30rem] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[18rem_1fr]">
      <aside className="border-b border-border md:border-b-0 md:border-r">
        <ul className="divide-y divide-border">
          {(inbox.data ?? []).map((c) => {
            const name = c.requester?.name?.trim() || "YardLine member";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                    selected?.id === c.id && "bg-muted",
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={avatarUrl(c.requester?.avatar)} alt={name} />
                    <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      {c.unread > 0 ? <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs">{c.unread}</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.last_message || "No messages yet"}</p>
                    <p className="text-[11px] text-muted-foreground">{formatRelativeTime(c.last_message_at ?? c.created_at)}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-h-[30rem] flex-col">
        <div className="border-b border-border p-3">
          <p className="font-semibold">{selected?.requester?.name?.trim() || "Organization conversation"}</p>
          <p className="text-xs text-muted-foreground">Shared inbox · visible to current organization leadership</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            (messages.data ?? []).map((m) => {
              const mine = m.sender_id === me;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                      mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={cn("mt-1 text-right text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {formatClockTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Reply from the organization inbox"
              rows={1}
              className="max-h-32 min-h-11 resize-none"
            />
            <Button size="icon" className="h-11 w-11 shrink-0" onClick={submit} disabled={!draft.trim() || sendOrgMessage.isPending}>
              {sendOrgMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
