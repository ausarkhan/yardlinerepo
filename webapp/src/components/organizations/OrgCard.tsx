import { Link } from "react-router-dom";
import { Users, CalendarDays } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { avatarUrl, initials } from "@/lib/helpers";
import { orgCategoryLabel } from "@/lib/organizations";
import type { Organization } from "@/lib/types";

export function OrgCard({ org, upcoming }: { org: Organization; upcoming?: number }) {
  return (
    <Link
      to={`/organizations/${org.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="h-20 bg-gradient-to-br from-primary/20 to-secondary/20">
        {org.cover && avatarUrl(org.cover) ? (
          <img src={avatarUrl(org.cover)} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="-mt-8 flex flex-1 flex-col px-4 pb-4">
        <Avatar className="h-14 w-14 border-4 border-card shadow-sm">
          <AvatarImage src={avatarUrl(org.logo)} alt={org.name} />
          <AvatarFallback className="bg-secondary font-bold text-secondary-foreground">
            {initials(org.name)}
          </AvatarFallback>
        </Avatar>
        <div className="mt-2 flex items-center gap-2">
          <h3 className="line-clamp-1 font-heading text-lg font-bold">{org.name}</h3>
        </div>
        <Badge variant="secondary" className="mt-1 w-fit border-0 text-xs">
          {orgCategoryLabel(org.category)}
        </Badge>
        {org.description ? (
          <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{org.description}</p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {org.member_count ?? 0} member{(org.member_count ?? 0) === 1 ? "" : "s"}
          </span>
          {upcoming != null ? (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {upcoming} upcoming
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
