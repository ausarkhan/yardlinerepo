import { useState } from "react";
import { Ban, RotateCcw, Search, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModerationActionDialog } from "./ModerationActionDialog";
import { useAdminUsers, useModerationActions } from "@/hooks/useAdmin";
import { avatarUrl, initials, formatEventDate } from "@/lib/helpers";
import type { Profile } from "@/lib/types";
import { toast } from "sonner";

export function AdminUsersTable() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useAdminUsers(0, search);
  const { suspendUser, reinstateUser } = useModerationActions();
  const [target, setTarget] = useState<Profile | null>(null);

  const suspended = (p: Profile) => p.status === "suspended";

  const onConfirm = (reason: string) => {
    if (!target) return;
    const action = suspended(target) ? reinstateUser : suspendUser;
    action.mutate(
      { userId: target.id, reason },
      {
        onSuccess: () => {
          toast.success(suspended(target) ? "User reinstated." : "User suspended.");
          setTarget(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, handle, or email"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (users ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              (users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={avatarUrl(u.avatar)} alt={u.name ?? ""} />
                        <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {u.name ?? "Member"}
                          {u.role === "admin" ? <Shield className="h-3.5 w-3.5 text-primary" /> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email ?? u.handle}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatEventDate(u.joined_date, { withYear: true })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        suspended(u)
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-green/30 bg-green/10 text-green"
                      }
                    >
                      {suspended(u) ? "Suspended" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={suspended(u) ? "outline" : "destructive"}
                      onClick={() => setTarget(u)}
                      disabled={u.role === "admin"}
                    >
                      {suspended(u) ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" /> Reinstate
                        </>
                      ) : (
                        <>
                          <Ban className="h-3.5 w-3.5" /> Suspend
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ModerationActionDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target && suspended(target) ? "Reinstate user" : "Suspend user"}
        description={
          target && suspended(target)
            ? `Restore access for ${target?.name ?? "this user"}.`
            : `Suspend ${target?.name ?? "this user"}. They'll be blocked from participating.`
        }
        confirmLabel={target && suspended(target) ? "Reinstate" : "Suspend"}
        destructive={!!target && !suspended(target)}
        pending={suspendUser.isPending || reinstateUser.isPending}
        onConfirm={onConfirm}
      />
    </div>
  );
}
