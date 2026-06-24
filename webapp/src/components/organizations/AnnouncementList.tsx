import { Megaphone, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useAnnouncements } from "@/hooks/useOrganizations";
import { formatRelativeTime } from "@/lib/helpers";

const VIS_META: Record<string, { icon: typeof Lock; label: string }> = {
  public: { icon: Megaphone, label: "Public" },
  members: { icon: Users, label: "Members" },
  officers: { icon: Lock, label: "Officers" },
};

export function AnnouncementList({ orgId }: { orgId: string }) {
  const { data, isLoading } = useAnnouncements(orgId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if ((data ?? []).length === 0) {
    return (
      <EmptyState icon={Megaphone} title="No announcements yet" description="Officer updates will show up here." />
    );
  }

  return (
    <ul className="space-y-3">
      {(data ?? []).map((a) => {
        const vis = VIS_META[a.visibility] ?? VIS_META.public;
        return (
          <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-bold">{a.title}</h3>
              <Badge variant="outline" className="shrink-0 gap-1">
                <vis.icon className="h-3 w-3" />
                {vis.label}
              </Badge>
            </div>
            {a.body ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">{formatRelativeTime(a.created_at)}</p>
          </li>
        );
      })}
    </ul>
  );
}
