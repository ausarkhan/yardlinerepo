import { MessageSquare } from "lucide-react";
import { useConversations } from "@/hooks/useMessaging";
import { ConversationList } from "@/components/messaging/ConversationList";

export default function Messages() {
  const { data, isLoading } = useConversations();

  return (
    <div className="container max-w-2xl py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <MessageSquare className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Messages</h1>
          <p className="text-sm text-muted-foreground">Your conversations with providers, hosts, and customers.</p>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ConversationList conversations={data ?? []} isLoading={isLoading} />
      </div>
    </div>
  );
}
