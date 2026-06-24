import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Users, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/common/SmartImage";
import type { YardEvent } from "@/lib/types";
import {
  eventImage,
  formatEventDate,
  formatDollars,
  titleCase,
  isPastDate,
} from "@/lib/helpers";

export function EventCard({ event, index = 0 }: { event: YardEvent; index?: number }) {
  const remaining =
    event.max_tickets != null
      ? Math.max(0, event.max_tickets - (event.tickets_sold ?? 0))
      : null;
  const soldOut = remaining === 0;
  const past = isPastDate(event.date);

  return (
    <Link
      to={`/event/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card card-hover animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, animationFillMode: "both" }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <SmartImage
          src={eventImage(event)}
          alt={event.title ?? "Event"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          {event.category ? (
            <Badge className="border-0 bg-background/90 text-foreground backdrop-blur">
              {titleCase(event.category)}
            </Badge>
          ) : <span />}
          <Badge
            className={
              event.is_free
                ? "border-0 bg-green text-white"
                : "border-0 bg-primary text-primary-foreground"
            }
          >
            {event.is_free ? "Free" : formatDollars(event.ticket_price)}
          </Badge>
        </div>
        {past ? (
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-3">
            <Badge variant="secondary" className="border-0">Past event</Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 font-heading text-lg font-bold leading-snug">
          {event.title ?? "Untitled event"}
        </h3>
        <div className="mt-auto space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            {formatEventDate(event.date)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{event.location || "Location TBA"}</span>
          </p>
          <p className="flex items-center gap-2">
            {event.is_free ? (
              <>
                <Users className="h-4 w-4 shrink-0 text-primary" />
                {event.rsvp_count ?? 0} going
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4 shrink-0 text-primary" />
                {soldOut
                  ? "Sold out"
                  : remaining != null
                    ? `${remaining} tickets left`
                    : "Tickets available"}
              </>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
