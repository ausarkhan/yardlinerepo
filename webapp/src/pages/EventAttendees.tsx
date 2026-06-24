import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, Users, Download, Ticket, PartyPopper } from "lucide-react";
import { useEvent } from "@/hooks/useEvents";
import { useEventAttendees } from "@/hooks/useEventAttendees";
import { useAuthStore } from "@/store/auth";
import { EmptyState } from "@/components/common/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ticketStatusStyle } from "@/lib/yardtix";
import { avatarUrl, initials, formatEventDate } from "@/lib/helpers";

export default function EventAttendees() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const isHost = !!userId && !!event && event.host_id === userId;
  const { data: attendees, isLoading } = useEventAttendees(id, isHost);

  if (eventLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={Users}
          title="Event not found"
          description="This event may have been removed."
          action={<Button onClick={() => navigate("/creator-dashboard?tab=events")}>Back to dashboard</Button>}
        />
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={Lock}
          title="Host access only"
          description="Only the host of this event can view its attendee list."
          action={<Button onClick={() => navigate(`/event/${event.id}`)}>View event</Button>}
        />
      </div>
    );
  }

  const list = attendees ?? [];

  function exportCsv() {
    const header = ["Name", "Email", "Type", "Status", "Order", "Ticket", "Created"];
    const rows = list.map((a) => [
      a.name,
      a.email,
      a.kind,
      a.status,
      a.orderNumber,
      a.ticketNumber,
      a.createdAt ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendees-${event?.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container max-w-4xl py-6 md:py-8">
      <Link
        to={`/event/${event.id}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to event
      </Link>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Attendees</h1>
          <p className="mt-1 text-muted-foreground">{event.title}</p>
        </div>
        {list.length > 0 ? (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : null}
      </header>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No attendees yet"
          description="When people RSVP or reserve tickets, they’ll show up here."
        />
      ) : (
        <>
          {/* Summary */}
          <div className="mb-5 flex gap-3">
            <Badge variant="outline" className="gap-1.5 border-green/30 bg-green/10 text-green">
              <PartyPopper className="h-3.5 w-3.5" />
              {list.filter((a) => a.kind === "rsvp").length} RSVPs
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 text-primary">
              <Ticket className="h-3.5 w-3.5" />
              {list.filter((a) => a.kind === "ticket").length} tickets
            </Badge>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Attendee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={avatarUrl(a.avatar)} alt={a.name} />
                          <AvatarFallback className="text-xs">{initials(a.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{a.kind}</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border capitalize", ticketStatusStyle(a.status))}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.orderNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatEventDate(a.createdAt, { withYear: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {list.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={avatarUrl(a.avatar)} alt={a.name} />
                    <AvatarFallback className="text-xs">{initials(a.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                  </div>
                  <Badge variant="outline" className={cn("border capitalize", ticketStatusStyle(a.status))}>
                    {a.status}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                  <span className="capitalize">{a.kind}</span>
                  <span className="font-mono">{a.orderNumber}</span>
                  <span>{formatEventDate(a.createdAt, { withYear: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
