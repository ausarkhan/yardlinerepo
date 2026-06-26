import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { MessageSquare } from "lucide-react";
import type { ConversationView } from "@/hooks/useMessaging";
import { avatarUrl, initials, formatRelativeTime } from "@/lib/helpers";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: ConversationView[];
  isLoading: boolean;
  activeId?: string;
}

export function ConversationList({ conversations, isLoading, activeId }: ConversationListProps) {
  const me = useAuthStore((s) => s.user?.id);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No conversations yet"
        description="Start a chat from a provider, event, or booking."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((c) => {
        const name = c.org?.name?.trim() || c.other?.name?.trim() || "YardLine member";
        const avatar = c.org?.logo || c.other?.avatar;
        const mine = c.last_sender_id === me;
        return (
          <li key={c.id}>
            <Link
              to={`/chat/${c.id}`}
              className={cn(
                "flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/60",
                activeId === c.id && "bg-muted",
              )}
            >
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage src={avatarUrl(avatar)} alt={name} />
                <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold leading-tight">{name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(c.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-sm", c.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {c.last_message ? `${mine ? "You: " : ""}${c.last_message}` : "No messages yet"}
                  </p>
                  {c.unread > 0 ? (
                    <Badge className="h-5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-xs">
                      {c.unread}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
