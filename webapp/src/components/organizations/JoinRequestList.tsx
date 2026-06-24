import { Check, X, Inbox, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useJoinRequests, useOrgActions } from "@/hooks/useOrganizations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { avatarUrl, initials, formatRelativeTime } from "@/lib/helpers";
import type { Profile, OrgJoinRequest } from "@/lib/types";
import { toast } from "sonner";

// Pending join requests with approve/deny (officers + advisors).
export function JoinRequestList({ orgId, canApprove }: { orgId: string; canApprove: boolean }) {
  const { data: requests, isLoading } = useJoinRequests(orgId, canApprove);
  const { decideRequest } = useOrgActions(orgId);

  const profiles = useQuery({
    queryKey: ["join-request-profiles", orgId, (requests ?? []).length],
    enabled: !!requests && requests.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((requests ?? []).map((r) => r.user_id)));
      const { data } = await supabase.from("profiles").select("*").in("id", ids);
      const map: Record<string, Profile> = {};
      (data ?? []).forEach((p) => (map[(p as Profile).id] = p as Profile));
      return map;
    },
  });

  if (!canApprove) return null;

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-xl" />;
  }

  if ((requests ?? []).length === 0) {
    return <EmptyState icon={Inbox} title="No pending requests" description="New join requests will appear here." />;
  }

  const decide = (request: OrgJoinRequest, approve: boolean) => {
    decideRequest.mutate(
      { request, approve },
      {
        onSuccess: () => toast.success(approve ? "Member approved." : "Request denied."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
      },
    );
  };

  return (
    <ul className="space-y-2">
      {(requests ?? []).map((r) => {
        const p = profiles.data?.[r.user_id];
        const name = p?.name?.trim() || "Student";
        return (
          <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl(p?.avatar)} alt={name} />
              <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.message ? r.message : `Requested ${formatRelativeTime(r.created_at)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => decide(r, false)} disabled={decideRequest.isPending}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={() => decide(r, true)} disabled={decideRequest.isPending}>
                {decideRequest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
