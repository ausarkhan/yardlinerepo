import { Loader2, UserPlus, Clock, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { join, leave } = useOrgActions(org.id);

  if (!me || org.created_by === me) return null;

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

  return (
    <Button
      size="sm"
      disabled={join.isPending}
      onClick={() =>
        join.mutate(
          { orgId: org.id },
          {
            onSuccess: () => toast.success("Request sent! An officer will review it."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send request."),
          },
        )
      }
    >
      {join.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Request to join
    </Button>
  );
}
