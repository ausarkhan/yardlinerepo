import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Users } from "lucide-react";
import { RoleBadge } from "./RoleBadge";
import { useOrgMembers } from "@/hooks/useOrganizations";
import { useQuery } from "@tanstack/react-query";
import { fetchMemberProfiles } from "@/lib/organizations";
import { avatarUrl, initials } from "@/lib/helpers";
import type { OrganizationMember } from "@/lib/types";

interface MemberListProps {
  orgId: string;
  // Optional per-row action slot (e.g. manage controls for officers).
  renderAction?: (member: OrganizationMember) => React.ReactNode;
}

// Members are ordered by seniority for display.
const ROLE_ORDER: Record<string, number> = {
  president: 0,
  admin: 1,
  officer: 2,
  treasurer: 3,
  advisor: 4,
  member: 5,
};

export function MemberList({ orgId, renderAction }: MemberListProps) {
  const { data: members, isLoading } = useOrgMembers(orgId);
  const profiles = useQuery({
    queryKey: ["org-member-profiles", orgId, (members ?? []).length],
    enabled: !!members && members.length > 0,
    queryFn: () => fetchMemberProfiles(members ?? []),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  const list = (members ?? [])
    .slice()
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));

  if (list.length === 0) {
    return <EmptyState icon={Users} title="No members yet" description="Approved members will appear here." />;
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {list.map((m) => {
        const p = profiles.data?.[m.user_id];
        const name = p?.name?.trim() || "Member";
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl(p?.avatar)} alt={name} />
              <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name}</p>
              {p?.handle ? <p className="truncate text-xs text-muted-foreground">{p.handle}</p> : null}
            </div>
            <RoleBadge role={m.role} />
            {renderAction ? renderAction(m) : null}
          </li>
        );
      })}
    </ul>
  );
}
