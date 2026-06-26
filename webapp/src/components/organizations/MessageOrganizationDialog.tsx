import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useOrgActions } from "@/hooks/useOrganizations";
import type { Organization } from "@/lib/types";
import { toast } from "sonner";

export function MessageOrganizationDialog({ org }: { org: Organization }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { startOrgConversation } = useOrgActions(org.id);

  const submit = () => {
    const body = message.trim();
    if (!body) return;
    startOrgConversation.mutate(
      { orgId: org.id, initialMessage: body },
      {
        onSuccess: () => {
          toast.success("Message sent to the organization inbox.");
          setMessage("");
          setOpen(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send message."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message {org.name}</DialogTitle>
          <DialogDescription>
            Your message goes to the shared organization inbox for officers and advisors.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about joining, sponsorships, collaborations, events, or partnerships."
          className="min-h-32"
        />
        <DialogFooter>
          <Button onClick={submit} disabled={!message.trim() || startOrgConversation.isPending}>
            {startOrgConversation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
