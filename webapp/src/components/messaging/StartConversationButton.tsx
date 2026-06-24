import { useNavigate } from "react-router-dom";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStartConversation } from "@/hooks/useMessaging";
import { useAuthStore } from "@/store/auth";
import type { ConversationContext } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StartConversationButtonProps {
  otherUserId: string | null | undefined;
  context?: ConversationContext;
  contextId?: string | null;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}

// Opens (or reuses) a 1:1 conversation with `otherUserId`, then navigates to the
// thread. Hidden when there's no valid other party or it's yourself.
export function StartConversationButton({
  otherUserId,
  context = "direct",
  contextId = null,
  label = "Message",
  size = "sm",
  variant = "outline",
  className,
}: StartConversationButtonProps) {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user?.id);
  const start = useStartConversation();

  if (!otherUserId || otherUserId === me) return null;

  const onClick = () => {
    start.mutate(
      { otherUserId, context, contextId },
      {
        onSuccess: (convo) => navigate(`/chat/${convo.id}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't start conversation."),
      },
    );
  };

  return (
    <Button size={size} variant={variant} className={className} onClick={onClick} disabled={start.isPending}>
      {start.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className={cn("h-4 w-4")} />
      )}
      {size === "icon" ? null : label}
    </Button>
  );
}
