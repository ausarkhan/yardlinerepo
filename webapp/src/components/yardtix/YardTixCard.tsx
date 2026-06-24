import { Link } from "react-router-dom";
import { QrCode, CalendarDays, MapPin, MoreVertical, Ticket, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ticketStatusStyle, type YardTix } from "@/lib/yardtix";
import { formatEventDate, formatEventTime, titleCase } from "@/lib/helpers";
import { TicketQr } from "./TicketQr";

interface YardTixCardProps {
  tix: YardTix;
  onCancel?: (id: string) => void;
  canceling?: boolean;
}

export function YardTixCard({ tix, onCancel, canceling }: YardTixCardProps) {
  const event = tix.event;
  const time = formatEventTime(event?.time ?? null);
  // Only paid tickets carry a real qr_token to scan at the door. RSVPs (and any
  // ticket missing its token) keep the icon placeholder.
  const hasQr = tix.kind === "ticket" && !!tix.qrToken;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Stub header */}
      <div className="flex items-stretch">
        {/* QR (real for paid tickets, placeholder otherwise) */}
        <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-border bg-muted/40 p-3 sm:w-28">
          {hasQr ? (
            <>
              <div className="rounded-lg bg-white p-1 shadow-sm">
                <TicketQr token={tix.qrToken} size={64} />
              </div>
              <span className="text-[10px] text-muted-foreground">Scan at door</span>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-foreground/5">
                <QrCode className="h-10 w-10 text-foreground/70" />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {tix.kind === "ticket" ? "Scan at door" : "Show at door"}
              </span>
            </>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/event/${tix.eventId}`}
                className="line-clamp-1 font-heading text-lg font-bold hover:text-primary"
              >
                {event?.title ?? "Event"}
              </Link>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {tix.kind === "ticket" ? (
                  <Ticket className="h-3.5 w-3.5" />
                ) : (
                  <PartyPopper className="h-3.5 w-3.5" />
                )}
                {tix.kind === "ticket" ? "Ticket" : "RSVP"}
                {event?.category ? ` · ${titleCase(event.category)}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={cn("border capitalize", ticketStatusStyle(tix.status))}>
                {tix.status}
              </Badge>
              {onCancel ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={canceling}
                      onClick={() => onCancel(tix.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      {tix.kind === "ticket" ? "Release ticket" : "Cancel RSVP"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0" />
              {formatEventDate(event?.date ?? null, { withYear: true })}
              {time ? ` · ${time}` : ""}
            </p>
            {event?.location ? (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{event.location}</span>
              </p>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-xs">
            <span className="font-mono text-foreground">{tix.ticketNumber}</span>
            <span className="text-muted-foreground">Order {tix.orderNumber}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
