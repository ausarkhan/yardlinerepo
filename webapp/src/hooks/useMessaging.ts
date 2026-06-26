import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import {
  listConversations,
  getConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  unreadMessageCount,
  unreadByConversation,
  fetchParticipantProfiles,
  getOrCreateConversation,
  otherParticipant,
} from "@/lib/messaging";
import type { Conversation, Message, Profile, ConversationContext } from "@/lib/types";

export interface ConversationView extends Conversation {
  other: Profile | null;
  org?: { name: string; logo: string | null } | null;
  unread: number;
}

// Conversation list with the other participant + unread counts hydrated.
export function useConversations() {
  const me = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["conversations", me],
    enabled: !!me,
    queryFn: async (): Promise<ConversationView[]> => {
      const convos = await listConversations(me!);
      if (convos.length === 0) return [];
      const [profiles, unread] = await Promise.all([
        fetchParticipantProfiles(me!, convos),
        unreadByConversation(me!, convos.map((c) => c.id)),
      ]);
      const orgIds = Array.from(
        new Set(
          convos
            .filter((c) => c.context_type === "organization" && c.context_id)
            .map((c) => c.context_id as string),
        ),
      );
      const orgMap: Record<string, { name: string; logo: string | null }> = {};
      if (orgIds.length > 0) {
        const { data } = await supabase.from("organizations").select("id,name,logo").in("id", orgIds);
        (data ?? []).forEach((o) => {
          const row = o as { id: string; name: string; logo: string | null };
          orgMap[row.id] = { name: row.name, logo: row.logo };
        });
      }
      return convos.map((c) => ({
        ...c,
        other: profiles[otherParticipant(c, me!)] ?? null,
        org: c.context_type === "organization" && c.context_id ? orgMap[c.context_id] ?? null : null,
        unread: unread[c.id] ?? 0,
      }));
    },
  });
}

// A single conversation thread + realtime message stream.
export function useConversation(conversationId: string | undefined) {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const meta = useQuery({
    queryKey: ["conversation", conversationId],
    enabled: !!conversationId,
    queryFn: () => getConversation(conversationId!),
  });

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: () => listMessages(conversationId!),
  });

  // Realtime: append new messages as they arrive.
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message;
          qc.setQueryData<Message[]>(["messages", conversationId], (prev) => {
            if (!prev) return [msg];
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          qc.invalidateQueries({ queryKey: ["conversations", me] });
          qc.invalidateQueries({ queryKey: ["unread-messages", me] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc, me]);

  const send = useMutation({
    mutationFn: (body: string) => {
      if (!conversationId || !me) throw new Error("Not ready");
      return sendMessage(conversationId, me, body);
    },
    onSuccess: (msg) => {
      // Optimistically reflect our own message (realtime also covers it).
      qc.setQueryData<Message[]>(["messages", conversationId], (prev) => {
        if (!prev) return [msg];
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      qc.invalidateQueries({ queryKey: ["conversations", me] });
    },
  });

  return { meta, messages, send };
}

// Mark a conversation read when it's opened.
export function useMarkConversationRead() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => {
      if (!me) throw new Error("Not authenticated");
      return markConversationRead(conversationId, me);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", me] });
      qc.invalidateQueries({ queryKey: ["unread-messages", me] });
    },
  });
}

export function useUnreadMessages() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-messages", me],
    enabled: !!me,
    queryFn: () => unreadMessageCount(me!),
    refetchInterval: 60_000,
  });

  // Realtime bump when any message lands for me.
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`unread-messages:${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["unread-messages", me] });
        qc.invalidateQueries({ queryKey: ["conversations", me] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, qc]);

  return query;
}

// Start (or reuse) a conversation, then hand back the id for navigation.
export function useStartConversation() {
  const me = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      otherUserId: string;
      context?: ConversationContext;
      contextId?: string | null;
    }) => {
      if (!me) throw new Error("Please sign in to send a message.");
      return getOrCreateConversation(me, input.otherUserId, input.context ?? "direct", input.contextId ?? null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", me] }),
  });
}
