import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, AlertCircle } from "lucide-react";
import { useHostEvents } from "@/hooks/useHostEvents";
import { useConnectStatus } from "@/hooks/useStripeConnect";
import { useAuthStore } from "@/store/auth";
import { HostEventRow } from "@/components/host/HostEventRow";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { setEventStatus } from "@/lib/events";
import { fetchTicketCountsByEvent } from "@/lib/orders";
import { canPublishEvent, isFreeEvent } from "@/lib/creatorGating";
import type { EventStatus } from "@/lib/yardtix";
import type { YardEvent } from "@/lib/types";
import { toast } from "sonner";

interface EventsTabProps {
  onActivatePayments: () => void;
}

export function EventsTab({ onActivatePayments }: EventsTabProps) {
  const { data, isLoading } = useHostEvents();
  const { data: connect } = useConnectStatus();
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const events = useMemo(() => data?.events ?? [], [data?.events]);

  // Minted (paid) ticket counts per event — graceful when the table is absent.
  const { data: mintedCounts } = useQuery({
    queryKey: ["host-ticket-counts", userId, events.map((e) => e.id).join(",")],
    enabled: events.length > 0,
    queryFn: () => fetchTicketCountsByEvent(events.map((e) => e.id)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) => setEventStatus(id, status),
    onSuccess: (_r, { status }) => {
      qc.invalidateQueries({ queryKey: ["host-events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(status === "published" ? "Event published 🎉" : "Event cancelled");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update event"),
  });

  // Paid drafts that can't go live until payments are active.
  const blockedPaidDrafts = useMemo(
    () =>
      events.filter(
        (e) => e.status === "draft" && !isFreeEvent(e) && !canPublishEvent(e, connect).ok,
      ).length,
    [events, connect],
  );

  function handlePublish(event: YardEvent) {
    const gate = canPublishEvent(event, connect);
    if (!gate.ok) {
      toast.error(gate.reason ?? "Activate payments to publish paid events.");
      return;
    }
    statusMutation.mutate({ id: event.id, status: "published" });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="No events yet"
        description="Create your first event to start collecting RSVPs and selling tickets."
        action={
          <Button asChild>
            <Link to="/create-event">Create your first event</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold">Your events</h2>
        <Button asChild size="sm" className="font-semibold">
          <Link to="/create-event">
            <CalendarPlus className="h-4 w-4" />
            Create event
          </Link>
        </Button>
      </div>

      {blockedPaidDrafts > 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Activate payments to publish paid events</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              You have {blockedPaidDrafts} paid draft{blockedPaidDrafts === 1 ? "" : "s"} that can’t
              go live yet. Free events can still be published.
            </span>
            <Button size="sm" variant="outline" onClick={onActivatePayments} className="shrink-0">
              Go to Payments
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {events.map((event) => (
          <HostEventRow
            key={event.id}
            event={event}
            stat={data?.stats?.[event.id] ?? { rsvps: 0, tickets: 0, total: 0 }}
            mintedTickets={mintedCounts?.[event.id] ?? 0}
            busy={statusMutation.isPending}
            onPublish={() => handlePublish(event)}
            onCancel={(id) => statusMutation.mutate({ id, status: "cancelled" })}
          />
        ))}
      </div>
    </div>
  );
}
