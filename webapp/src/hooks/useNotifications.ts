import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import {
  listNotifications,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications";

export function useNotifications() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", me],
    enabled: !!me,
    queryFn: () => listNotifications(me!),
  });

  // Realtime: new notifications for me refresh both the list and the badge.
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`notifications:${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", me] });
          qc.invalidateQueries({ queryKey: ["unread-notifications", me] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, qc]);

  return query;
}

export function useUnreadNotifications() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-notifications", me],
    enabled: !!me,
    queryFn: () => unreadNotificationCount(me!),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`unread-notifications:${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me}` },
        () => qc.invalidateQueries({ queryKey: ["unread-notifications", me] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, qc]);

  return query;
}

export function useNotificationActions() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications", me] });
    qc.invalidateQueries({ queryKey: ["unread-notifications", me] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: () => {
      if (!me) throw new Error("Not authenticated");
      return markAllNotificationsRead(me);
    },
    onSuccess: invalidate,
  });

  return { markRead, markAllRead };
}
