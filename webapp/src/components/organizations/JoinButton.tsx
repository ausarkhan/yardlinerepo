import { useState } from "react";
import { Loader2, UserPlus, Clock, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMyOrgRole, useMyJoinRequest, useOrgActions } from "@/hooks/useOrganizations";
import { useAuthStore } from "@/store/auth";
import type { Organization } from "@/lib/types";
import { toast } from "sonner";

// One button that reflects the viewer's relationship to the org:
//   not a member, no request → Request to join
//   pending request         → Requested (disabled)
//   member                  → Leave (confirm)
export function JoinButton({ org }: { org: Organization }) {
  const me = useAuthStore((s) => s.user?.id);
  const { data: membership } = useMyOrgRole(org.id);
  const { data: request } = useMyJoinRequest(org.id);
  const { join, joinOpen, leave } = useOrgActions(org.id);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [classification, setClassification] = useState("");
  const [major, setMajor] = useState("");
  const [interests, setInterests] = useState("");

  if (!me || org.created_by === me) return null;
  const membershipPolicy = org.membership_policy ?? "approval_required";

  if (membership) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={leave.isPending}>
            {leave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Leave
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {org.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to members-only content. You can request to join again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                leave.mutate(
                  { orgId: org.id },
                  {
                    onSuccess: () => toast.success("You left the organization."),
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't leave."),
                  },
                )
              }
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (request?.status === "pending") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Clock className="h-4 w-4" />
        Requested
      </Button>
    );
  }

  if (request?.status === "approved") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Check className="h-4 w-4" />
        Member
      </Button>
    );
  }

  if (membershipPolicy === "closed") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Clock className="h-4 w-4" />
        Membership closed
      </Button>
    );
  }

  const isOpenJoin = membershipPolicy === "open";
  const busy = join.isPending || joinOpen.isPending;
  const submit = () => {
    if (isOpenJoin) {
      joinOpen.mutate(
        { orgId: org.id },
        {
          onSuccess: () => {
            toast.success("You're now a member.");
            setOpen(false);
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't join."),
        },
      );
      return;
    }
    join.mutate(
      {
        orgId: org.id,
        input: {
          message,
          classification_year: classification,
          major,
          interests,
        },
      },
      {
        onSuccess: () => {
          toast.success("Request sent. An officer will review it.");
          setOpen(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send request."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" />
          {isOpenJoin ? "Join" : "Request membership"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isOpenJoin ? `Join ${org.name}` : `Request membership`}</DialogTitle>
          <DialogDescription>
            Tell us why you'd like to join.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-message">Message / reason</Label>
            <Textarea
              id="join-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share what you're interested in and how you'd like to participate."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="classification">Classification / year</Label>
              <Input id="classification" value={classification} onChange={(e) => setClassification(e.target.value)} placeholder="Junior, 2027" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="major">Major</Label>
              <Input id="major" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="Computer Science" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="interests">Interests</Label>
            <Input id="interests" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Events, service, leadership" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || (!isOpenJoin && !message.trim())}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {isOpenJoin ? "Join organization" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
