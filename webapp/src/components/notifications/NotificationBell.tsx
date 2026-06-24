import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, MessageSquare, CalendarCheck, Star, Flag, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, useUnreadNotifications, useNotificationActions } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/helpers";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  message: MessageSquare,
  booking_accepted: CalendarCheck,
  booking_declined: CalendarCheck,
  booking_completed: CalendarCheck,
  review_received: Star,
  report_update: Flag,
  admin_action: ShieldAlert,
  event_reminder: CalendarCheck,
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: items, isLoading } = useNotifications();
  const { data: unread } = useUnreadNotifications();
  const { markRead, markAllRead } = useNotificationActions();
  const count = unread ?? 0;

  const onOpen = (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {count > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {count > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>

        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (items ?? []).length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(items ?? []).map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => onOpen(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                        !n.read_at && "bg-primary/5",
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{n.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </span>
                        {n.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                        ) : null}
                      </span>
                      {!n.read_at ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
