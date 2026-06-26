import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminOrganizations, useModerationActions } from "@/hooks/useAdmin";
import { orgCategoryLabel } from "@/lib/organizations";
import type { OrgStatus } from "@/lib/types";
import { toast } from "sonner";

const STATUS_OPTIONS: OrgStatus[] = ["pending", "active", "inactive", "archived"];

export function AdminOrganizationsTable() {
  const { data: rows, isLoading } = useAdminOrganizations(0);
  const { setOrganizationStatus, assignOrganizationAdvisor } = useModerationActions();
  const [advisorDrafts, setAdvisorDrafts] = useState<Record<string, { name: string; email: string }>>({});

  const advisorDraft = (orgId: string, name: string | null, email: string | null) =>
    advisorDrafts[orgId] ?? { name: name ?? "", email: email ?? "" };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Advisor</TableHead>
            <TableHead className="hidden md:table-cell">Officers</TableHead>
            <TableHead className="hidden sm:table-cell">Events</TableHead>
            <TableHead className="text-right">Members</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [0, 1, 2].map((i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : (rows ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No organizations.
              </TableCell>
            </TableRow>
          ) : (
            (rows ?? []).map(({ organization, officers, eventCount }) => {
              const draft = advisorDraft(organization.id, organization.advisor_name, organization.advisor_email);
              return (
                <TableRow key={organization.id}>
                  <TableCell className="max-w-[240px]">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{organization.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {orgCategoryLabel(organization.category)}
                          {organization.department ? ` · ${organization.department}` : ""}
                        </p>
                      </div>
                      <Button asChild size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                        <Link to={`/organizations/${organization.id}`} aria-label={`View ${organization.name}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={organization.status as OrgStatus}
                      onValueChange={(status) =>
                        setOrganizationStatus.mutate(
                          {
                            organizationId: organization.id,
                            status: status as OrgStatus,
                            reason: `Admin changed organization status to ${status}`,
                          },
                          {
                            onSuccess: () => toast.success("Organization status updated."),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
                          },
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status} className="capitalize">
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden min-w-[260px] lg:table-cell">
                    <div className="flex gap-2">
                      <Input
                        value={draft.name}
                        onChange={(e) =>
                          setAdvisorDrafts((d) => ({
                            ...d,
                            [organization.id]: { ...draft, name: e.target.value },
                          }))
                        }
                        placeholder="Advisor name"
                        className="h-8"
                      />
                      <Input
                        value={draft.email}
                        onChange={(e) =>
                          setAdvisorDrafts((d) => ({
                            ...d,
                            [organization.id]: { ...draft, email: e.target.value },
                          }))
                        }
                        placeholder="Advisor email"
                        className="h-8"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() =>
                          assignOrganizationAdvisor.mutate(
                            {
                              organizationId: organization.id,
                              advisorName: draft.name,
                              advisorEmail: draft.email,
                            },
                            {
                              onSuccess: () => toast.success("Advisor updated."),
                              onError: (e) => toast.error(e instanceof Error ? e.message : "Advisor update failed."),
                            },
                          )
                        }
                        aria-label="Save advisor"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {officers.slice(0, 3).map((officer) => (
                        <Badge key={officer.id} variant="outline" className="capitalize">
                          {officer.role}
                        </Badge>
                      ))}
                      {officers.length > 3 ? <Badge variant="secondary">+{officers.length - 3}</Badge> : null}
                      {officers.length === 0 ? <span className="text-sm text-muted-foreground">None</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{eventCount}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {organization.member_count ?? 0} members
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
