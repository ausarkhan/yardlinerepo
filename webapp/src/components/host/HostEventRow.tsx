import { Link } from "react-router-dom";
import { Users, Ticket, Eye, Pencil, Send, Ban, UsersRound, DollarSign, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/common/SmartImage";
import { cn } from "@/lib/utils";
import { eventStatusStyle, eventStatusLabel } from "@/lib/yardtix";
import { eventImage, formatEventDate, formatPrice } from "@/lib/helpers";
import { isFreeEvent } from "@/lib/creatorGating";
import { eventTiers } from "@/lib/events";
import type { YardEvent } from "@/lib/types";
import type { EventStat } from "@/hooks/useHostEvents";

interface HostEventRowProps {
  event: YardEvent;
  stat: EventStat;
  mintedTickets?: number;
  onPublish: (id: string) => void;
  onCancel: (id: string) => void;
  busy?: boolean;
}

// Best-effort revenue estimate: minted ticket count × the event's base ticket
// price (single-tier price, or the lowest tier price). Used as a quick gauge,
// not an exact ledger.
function basePriceCents(event: YardEvent): number {
  const tiers = eventTiers(event);
  if (tiers.length > 0) {
    return Math.min(...tiers.map((t) => t.price_cents));
  }
  return Math.round(Number(event.ticket_price ?? 0) * 100);
}

export function HostEventRow({ event, stat, mintedTickets, onPublish, onCancel, busy }: HostEventRowProps) {
  const isDraft = event.status === "draft";
  const isCancelled = event.status === "cancelled";
  const free = isFreeEvent(event);
  // Prefer minted (paid) ticket counts when available; fall back to attendee stat.
  const ticketsCount = mintedTickets && mintedTickets > 0 ? mintedTickets : stat.tickets;
  const revenueEstimateCents = free ? 0 : ticketsCount * basePriceCents(event);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <Link to={`/event/${event.id}`} className="shrink-0">
        <div className="h-20 w-full overflow-hidden rounded-xl bg-muted sm:w-32">
          <SmartImage src={eventImage(event)} alt={event.title ?? ""} className="h-full w-full object-cover" />
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/event/${event.id}`} className="font-heading text-base font-bold hover:text-primary">
            {event.title ?? "Untitled event"}
          </Link>
          <Badge variant="outline" className={cn("border", eventStatusStyle(event.status ?? "draft"))}>
            {eventStatusLabel(event.status)}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "border",
              free ? "border-green/30 bg-green/15 text-green" : "border-primary/30 bg-primary/15 text-primary",
            )}
          >
            {free ? "Free" : "Ticketed"}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatEventDate(event.date, { withYear: true })}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {stat.rsvps} RSVPs
          </span>
          <span className="flex items-center gap-1.5">
            <Ticket className="h-4 w-4" />
            {ticketsCount} tickets sold
          </span>
          {!free ? (
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              {formatPrice(revenueEstimateCents)} est.
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/event/${event.id}`}>
              <Eye className="h-4 w-4" />
              View
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/event/${event.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/event/${event.id}/attendees`}>
              <UsersRound className="h-4 w-4" />
              Attendees
            </Link>
          </Button>
          {!isDraft && !isCancelled ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/event/${event.id}/checkin`}>
                <ScanLine className="h-4 w-4" />
                Check-in
              </Link>
            </Button>
          ) : null}
          {isDraft ? (
            <Button size="sm" disabled={busy} onClick={() => onPublish(event.id)}>
              <Send className="h-4 w-4" />
              Publish
            </Button>
          ) : !isCancelled ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onCancel(event.id)}
              className="text-destructive hover:text-destructive"
            >
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
