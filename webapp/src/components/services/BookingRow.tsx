import { CalendarDays, Clock, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { BookingView } from "@/hooks/useBookings";
import {
  bookingStatusLabel,
  bookingStatusStyle,
  paymentStatusLabel,
  paymentStatusStyle,
} from "@/lib/services";
import {
  providerName,
  avatarUrl,
  initials,
  formatPrice,
  formatEventDate,
  formatEventTime,
} from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface BookingRowProps {
  booking: BookingView;
  role: "customer" | "provider";
  actions?: React.ReactNode;
  showPayment?: boolean;
}

export function BookingRow({ booking, role, actions, showPayment }: BookingRowProps) {
  const serviceName = booking.service?.name ?? "Service";
  const total = booking.amount_total ?? 0;

  const partyName =
    role === "customer"
      ? booking.provider
        ? providerName(booking.provider)
        : "Provider"
      : booking.customer?.name?.trim() || "Customer";
  const partyAvatar =
    role === "customer" ? booking.provider?.user_data?.avatar : booking.customer?.avatar;
  const partyHandle =
    role === "customer" ? booking.provider?.user_data?.handle : booking.customer?.handle;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
            <AvatarImage src={avatarUrl(partyAvatar)} alt={partyName} />
            <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
              {initials(partyName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{serviceName}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" />
              {role === "customer" ? "with" : "for"} {partyName}
              {partyHandle ? <span className="text-muted-foreground/70">{partyHandle}</span> : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Badge variant="outline" className={cn("border", bookingStatusStyle(booking.status))}>
            {bookingStatusLabel(booking.status)}
          </Badge>
          {showPayment ? (
            <Badge variant="outline" className={cn("border", paymentStatusStyle(booking.payment_status))}>
              {paymentStatusLabel(booking.payment_status)}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" />
          {formatEventDate(booking.date, { withYear: true })}
        </span>
        {booking.time_start ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatEventTime(booking.time_start)}
            {booking.time_end ? ` – ${formatEventTime(booking.time_end)}` : ""}
          </span>
        ) : null}
        <span className="ml-auto font-heading text-base font-bold text-foreground">
          {formatPrice(total)}
        </span>
      </div>

      {booking.status === "declined" && booking.decline_reason ? (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Reason: {booking.decline_reason}
        </p>
      ) : null}

      {actions ? <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div> : null}
    </div>
  );
}
