import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversation, useMarkConversationRead } from "@/hooks/useMessaging";
import { MessageThread } from "@/components/messaging/MessageThread";
import { ReportButton } from "@/components/reports/ReportButton";
import { useAuthStore } from "@/store/auth";
import { otherParticipant } from "@/lib/messaging";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { avatarUrl, initials } from "@/lib/helpers";
import { toast } from "sonner";

export default function Chat() {
  const { id } = useParams();
  const me = useAuthStore((s) => s.user?.id);
  const { meta, messages, send } = useConversation(id);
  const markRead = useMarkConversationRead();

  const convo = meta.data;
  const otherId = convo && me ? otherParticipant(convo, me) : undefined;

  // Profile of the other participant for the header.
  const other = useQuery({
    queryKey: ["profile", otherId],
    enabled: !!otherId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      return data as { id: string; name: string | null; avatar: string | null; handle: string | null } | null;
    },
  });

  // Mark read whenever the thread is opened or new messages arrive.
  useEffect(() => {
    if (id) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages.data?.length]);

  const name = other.data?.name?.trim() || "YardLine member";

  return (
    <div className="container max-w-2xl py-4 md:py-6">
      <div className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-center gap-3 border-b border-border p-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/messages">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          {meta.isLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <>
              <Avatar className="h-10 w-10">
                <AvatarImage src={avatarUrl(other.data?.avatar)} alt={name} />
                <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{name}</p>
                {other.data?.handle ? (
                  <p className="truncate text-xs text-muted-foreground">{other.data.handle}</p>
                ) : null}
              </div>
              {otherId ? (
                <ReportButton targetType="user" targetId={otherId} variant="ghost" size="icon" iconOnly />
              ) : null}
            </>
          )}
        </header>

        <div className="min-h-0 flex-1">
          <MessageThread
            messages={messages.data ?? []}
            isLoading={messages.isLoading}
            sending={send.isPending}
            onSend={(body) =>
              send.mutate(body, {
                onError: (e) => toast.error(e instanceof Error ? e.message : "Message failed to send."),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
