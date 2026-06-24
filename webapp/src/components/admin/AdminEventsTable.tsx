import { useState } from "react";
import { EyeOff, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModerationActionDialog } from "./ModerationActionDialog";
import { useAdminEvents, useModerationActions } from "@/hooks/useAdmin";
import { formatEventDate } from "@/lib/helpers";
import type { YardEvent } from "@/lib/types";
import { toast } from "sonner";

export function AdminEventsTable() {
  const { data: events, isLoading } = useAdminEvents(0);
  const { setEventHidden } = useModerationActions();
  const [target, setTarget] = useState<YardEvent | null>(null);

  const onConfirm = (reason: string) => {
    if (!target) return;
    const hide = !target.is_hidden;
    setEventHidden.mutate(
      { eventId: target.id, hidden: hide, reason },
      {
        onSuccess: () => {
          toast.success(hide ? "Event hidden." : "Event restored.");
          setTarget(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="hidden md:table-cell">Tickets sold</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (events ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No events.
                </TableCell>
              </TableRow>
            ) : (
              (events ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[220px]">
                    <p className="truncate font-medium">{e.title ?? "Untitled"}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.location ?? "—"}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatEventDate(e.date, { withYear: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="capitalize">
                        {e.status ?? "draft"}
                      </Badge>
                      {e.is_hidden ? (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                          Hidden
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {e.tickets_sold ?? 0}
                    {e.max_tickets != null ? ` / ${e.max_tickets}` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={e.is_hidden ? "outline" : "destructive"}
                      onClick={() => setTarget(e)}
                    >
                      {e.is_hidden ? (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Restore
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Hide
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
        title={target?.is_hidden ? "Restore event" : "Hide event"}
        description={
          target?.is_hidden
            ? `Make "${target?.title ?? "this event"}" visible again.`
            : `Hide "${target?.title ?? "this event"}" from the platform. Tickets and data are preserved.`
        }
        confirmLabel={target?.is_hidden ? "Restore" : "Hide"}
        destructive={!target?.is_hidden}
        pending={setEventHidden.isPending}
        onConfirm={onConfirm}
      />
    </div>
  );
}
