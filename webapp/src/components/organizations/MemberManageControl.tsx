import { UserMinus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useOrgActions } from "@/hooks/useOrganizations";
import { ASSIGNABLE_ROLES, ORG_ROLE_LABELS, isLeader } from "@/lib/organizations";
import type { OrganizationMember, OrgRole } from "@/lib/types";
import { toast } from "sonner";

interface MemberManageControlProps {
  orgId: string;
  member: OrganizationMember;
  viewerRole: string | null | undefined; // the acting officer's role
  selfId: string | undefined;
}

// Role reassignment + removal. Only LEADERS (president/admin) may change roles to
// or from officer/president (manage officers); regular officers can manage plain
// members only. The president row can't be demoted from here.
export function MemberManageControl({ orgId, member, viewerRole, selfId }: MemberManageControlProps) {
  const { setRole, removeMember } = useOrgActions(orgId);
  const leader = isLeader(viewerRole);
  const isSelf = member.user_id === selfId;
  const isPresident = member.role === "president";

  // A non-leader officer may only manage plain members; leaders manage everyone
  // except they can't strip the president here.
  const canManage = (leader ? !isPresident : member.role === "member") && !isSelf;
  const roleChoices: OrgRole[] = leader ? ASSIGNABLE_ROLES : (["member", "officer"] as OrgRole[]);

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={member.role}
        onValueChange={(v) =>
          setRole.mutate(
            { memberId: member.id, role: v as OrgRole },
            {
              onSuccess: () => toast.success(`Role updated to ${ORG_ROLE_LABELS[v as OrgRole]}.`),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update role."),
            },
          )
        }
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roleChoices.map((r) => (
            <SelectItem key={r} value={r} className="text-xs">
              {ORG_ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Remove member">
            <UserMinus className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll lose access to members-only content. They can request to join again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                removeMember.mutate(
                  { memberId: member.id },
                  {
                    onSuccess: () => toast.success("Member removed."),
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove."),
                  },
                )
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
