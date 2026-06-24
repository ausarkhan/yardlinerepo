import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { OrgCard } from "@/components/organizations/OrgCard";
import { useOrganizations, useOrgUpcomingCounts } from "@/hooks/useOrganizations";
import { ORG_CATEGORIES } from "@/lib/organizations";
import type { OrgCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Organizations() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<OrgCategory | "all">("all");
  const { data: orgs, isLoading } = useOrganizations(search, category);

  const ids = useMemo(() => (orgs ?? []).map((o) => o.id), [orgs]);
  const { data: upcoming } = useOrgUpcomingCounts(ids);

  return (
    <div className="container max-w-6xl py-8 md:py-12">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Organizations</h1>
            <p className="text-sm text-muted-foreground">Discover and join campus clubs and organizations.</p>
          </div>
        </div>
        <Button asChild className="font-semibold">
          <Link to="/organizations/new">
            <Plus className="h-4 w-4" />
            Start an organization
          </Link>
        </Button>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations"
          className="pl-9"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("all")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            category === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          All
        </button>
        {ORG_CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              category === c.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : (orgs ?? []).length === 0 ? (
        <EmptyState
          icon={Users2}
          title="No organizations found"
          description="Try a different search or category — or start your own."
          action={
            <Button asChild>
              <Link to="/organizations/new">Start an organization</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(orgs ?? []).map((org) => (
            <OrgCard key={org.id} org={org} upcoming={upcoming?.[org.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}
