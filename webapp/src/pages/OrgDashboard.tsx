import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Users2, Plus, CalendarPlus, Pencil, Activity, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { MemberList } from "@/components/organizations/MemberList";
import { MemberManageControl } from "@/components/organizations/MemberManageControl";
import { JoinRequestList } from "@/components/organizations/JoinRequestList";
import { AnnouncementList } from "@/components/organizations/AnnouncementList";
import { PostAnnouncementDialog } from "@/components/organizations/PostAnnouncementDialog";
import { RoleBadge } from "@/components/organizations/RoleBadge";
import { useMyMemberships, useOrgActivity } from "@/hooks/useOrganizations";
import { useAuthStore } from "@/store/auth";
import { isOfficer, isApprover, isLeader } from "@/lib/organizations";
import { avatarUrl, initials, formatRelativeTime, titleCase } from "@/lib/helpers";

export default function OrgDashboard() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user?.id);
  const { data: memberships, isLoading } = useMyMemberships();
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get("org"));

  // Default to the first organization once memberships load.
  useEffect(() => {
    if (!selectedId && memberships && memberships.length > 0) {
      setSelectedId(memberships[0].organization_id);
    }
  }, [memberships, selectedId]);

  const selected = memberships?.find((m) => m.organization_id === selectedId) ?? null;
  const role = selected?.role;
  const officer = isOfficer(role);
  const approver = isApprover(role);
  const leader = isLeader(role);

  const activity = useOrgActivity(selectedId ?? undefined, !!selected);

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-12">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!memberships || memberships.length === 0) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={Users2}
          title="You're not in any organizations yet"
          description="Join a campus organization or start your own."
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/organizations">Browse</Link>
              </Button>
              <Button asChild>
                <Link to="/organizations/new">Start one</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8 md:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Org dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your organizations.</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/organizations/new">
            <Plus className="h-4 w-4" />
            New
          </Link>
        </Button>
      </header>

      {/* Org switcher */}
      <div className="mb-6 flex flex-wrap gap-2">
        {memberships.map((m) => (
          <button
            key={m.organization_id}
            onClick={() => {
              setSelectedId(m.organization_id);
              setParams({ org: m.organization_id }, { replace: true });
            }}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              selectedId === m.organization_id
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={avatarUrl(m.organization?.logo)} alt={m.organization?.name ?? ""} />
              <AvatarFallback className="text-[10px]">{initials(m.organization?.name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{m.organization?.name ?? "Organization"}</span>
            <RoleBadge role={m.role} className="ml-1" />
          </button>
        ))}
      </div>

      {!selected ? null : (
        <>
          {/* Quick actions */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/organizations/${selected.organization_id}`}>
                <ExternalLink className="h-4 w-4" />
                View page
              </Link>
            </Button>
            {officer ? (
              <Button size="sm" onClick={() => navigate(`/create-event?org=${selected.organization_id}`)}>
                <CalendarPlus className="h-4 w-4" />
                Create org event
              </Button>
            ) : null}
            {leader ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/organizations/${selected.organization_id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
            ) : null}
            {officer ? <PostAnnouncementDialog orgId={selected.organization_id} /> : null}
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              {approver ? <TabsTrigger value="requests">Requests</TabsTrigger> : null}
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div>
                <h2 className="mb-3 font-heading text-lg font-bold">Announcements</h2>
                <AnnouncementList orgId={selected.organization_id} />
              </div>
              <div>
                <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold">
                  <Activity className="h-4 w-4" /> Recent activity
                </h2>
                {activity.isLoading ? (
                  <Skeleton className="h-16 w-full rounded-xl" />
                ) : (activity.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {(activity.data ?? []).map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                        <span>{titleCase(a.action)}</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(a.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="members">
              <MemberList
                orgId={selected.organization_id}
                renderAction={
                  officer
                    ? (member) => (
                        <MemberManageControl
                          orgId={selected.organization_id}
                          member={member}
                          viewerRole={role}
                          selfId={me}
                        />
                      )
                    : undefined
                }
              />
            </TabsContent>

            {approver ? (
              <TabsContent value="requests">
                <JoinRequestList orgId={selected.organization_id} canApprove={approver} />
              </TabsContent>
            ) : null}

            <TabsContent value="announcements" className="space-y-4">
              {officer ? <PostAnnouncementDialog orgId={selected.organization_id} /> : null}
              <AnnouncementList orgId={selected.organization_id} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
