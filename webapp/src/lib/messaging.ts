// Messaging domain layer (Phase 5).
//
// 1:1 conversations keyed by an ORDERED participant pair (participant_a is always
// the smaller uuid) plus an optional context (provider / booking / event). All
// access is RLS-enforced: a caller only ever sees conversations they're in.

import { supabase } from "./supabase";
import type { Conversation, Message, ConversationContext, Profile } from "./types";

const PAGE = 30; // messages per page — keeps history loads small (perf requirement)

// Order a pair so (a,b) and (b,a) resolve to the same conversation row.
function orderPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export function otherParticipant(c: Conversation, me: string): string {
  return c.participant_a === me ? c.participant_b : c.participant_a;
}

// Find (or create) the 1:1 conversation between me and `otherUserId` for a given
// context. Returns the conversation id.
export async function getOrCreateConversation(
  me: string,
  otherUserId: string,
  context: ConversationContext = "direct",
  contextId: string | null = null,
): Promise<Conversation> {
  if (!me || !otherUserId) throw new Error("Missing participants");
  if (me === otherUserId) throw new Error("You can't message yourself.");
  const [a, b] = orderPair(me, otherUserId);

  // Try to find an existing thread for this exact context first.
  const existing = await supabase
    .from("conversations")
    .select("*")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .eq("context_type", context)
    .eq("context_id", contextId ?? "")
    .maybeSingle();
  if (existing.data) return existing.data as Conversation;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      participant_a: a,
      participant_b: b,
      context_type: context,
      context_id: contextId,
    })
    .select()
    .single();
  // A concurrent insert may race us to the unique index — re-read on conflict.
  if (error) {
    const retry = await supabase
      .from("conversations")
      .select("*")
      .eq("participant_a", a)
      .eq("participant_b", b)
      .eq("context_type", context)
      .eq("context_id", contextId ?? "")
      .maybeSingle();
    if (retry.data) return retry.data as Conversation;
    throw error;
  }
  return data as Conversation;
}

export async function listConversations(me: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`participant_a.eq.${me},participant_b.eq.${me}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Conversation) ?? null;
}

// Latest page of messages (oldest→newest for display). Pass a `before` ISO
// timestamp to page further back into history.
export async function listMessages(
  conversationId: string,
  before?: string,
): Promise<Message[]> {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Message[]).reverse();
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message is empty");
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

// Mark every message the OTHER party sent in this conversation as read.
export async function markConversationRead(conversationId: string, me: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", me)
    .is("read_at", null);
  if (error) throw error;
}

// Unread message count across all the caller's conversations (for the nav badge).
export async function unreadMessageCount(me: string): Promise<number> {
  // Conversations I'm in...
  const convos = await listConversations(me);
  if (convos.length === 0) return 0;
  const ids = convos.map((c) => c.id);
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", ids)
    .neq("sender_id", me)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

// Per-conversation unread counts, keyed by conversation id.
export async function unreadByConversation(
  me: string,
  conversationIds: string[],
): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {};
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", me)
    .is("read_at", null);
  if (error) throw error;
  const map: Record<string, number> = {};
  (data ?? []).forEach((m) => {
    const id = (m as { conversation_id: string }).conversation_id;
    map[id] = (map[id] ?? 0) + 1;
  });
  return map;
}

// Hydrate the "other participant" profiles for a set of conversations.
export async function fetchParticipantProfiles(
  me: string,
  convos: Conversation[],
): Promise<Record<string, Profile>> {
  const ids = Array.from(new Set(convos.map((c) => otherParticipant(c, me)))).filter(Boolean);
  if (ids.length === 0) return {};
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  const map: Record<string, Profile> = {};
  (data ?? []).forEach((p) => (map[(p as Profile).id] = p as Profile));
  return map;
}
