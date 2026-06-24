import { Link } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  CreditCard,
  Loader2,
  ReceiptText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BookingLifecycle } from "./BookingLifecycle";
import type { BookingView } from "@/hooks/useBookings";
import { useBookingActions } from "@/hooks/useBookings";
import {
  bookingStatusLabel,
  bookingStatusStyle,
  paymentStatusLabel,
  paymentStatusStyle,
  canCustomerCancel,
  cardStatusInfo,
  priceBreakdown,
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
import { toast } from "sonner";

interface BookingDetailDialogProps {
  booking: BookingView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CARD_TONE: Record<string, string> = {
  paid: "border-green/30 bg-green/10 text-green",
  pending: "border-primary/30 bg-primary/5 text-primary",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted/40 text-muted-foreground",
};

export function BookingDetailDialog({ booking, open, onOpenChange }: BookingDetailDialogProps) {
  const { cancel } = useBookingActions();

  if (!booking) return null;

  const serviceName = booking.service?.name ?? "Service";
  const provName = booking.provider ? providerName(booking.provider) : "Provider";
  const avatar = booking.provider?.user_data?.avatar;

  // Prefer the amounts stored on the booking; fall back to recomputing from the
  // service price if an older row predates the Phase 4 breakdown columns.
  const fallback = priceBreakdown(booking.service?.price_cents ?? 0);
  const servicePrice = booking.service_price_cents ?? fallback.service_price_cents;
  const platformFee = booking.platform_fee_cents ?? fallback.platform_fee_cents;
  const total = booking.amount_total ?? servicePrice + platformFee;

  const card = cardStatusInfo(booking.status, booking.payment_status);
  const cancelable = canCustomerCancel(booking.status, booking.payment_status);
  const captured = booking.payment_status === "captured";

  const onCancel = () => {
    cancel.mutate(booking.id, {
      onSuccess: () => {
        toast.success("Booking cancelled — any hold on your card was released.");
        onOpenChange(false);
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Couldn't cancel this booking."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="space-y-0 border-b border-border p-5 text-left">
          <DialogTitle className="font-heading text-xl">{serviceName}</DialogTitle>
          <DialogDescription className="sr-only">Booking details</DialogDescription>
          <div className="mt-3 flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
              <AvatarImage src={avatarUrl(avatar)} alt={provName} />
              <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                {initials(provName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">Provider</p>
              <p className="font-semibold leading-tight">{provName}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-5">
          {/* Status + payment + when */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border", bookingStatusStyle(booking.status))}>
              {bookingStatusLabel(booking.status)}
            </Badge>
            <Badge
              variant="outline"
              className={cn("border", paymentStatusStyle(booking.payment_status))}
            >
              {paymentStatusLabel(booking.payment_status)}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
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
          </div>

          {/* Card state */}
          <div className={cn("flex items-start gap-3 rounded-xl border p-3", CARD_TONE[card.tone])}>
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">{card.label}</p>
              <p className="text-xs opacity-90">{card.detail}</p>
            </div>
          </div>

          {/* Price breakdown */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Price</h4>
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{formatPrice(servicePrice)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Platform fee</span>
                <span className="font-medium">{formatPrice(platformFee)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between py-1">
                <span className="font-semibold">Total</span>
                <span className="font-heading text-lg font-bold">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Lifecycle */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Progress</h4>
            <BookingLifecycle status={booking.status} paymentStatus={booking.payment_status} />
          </div>

          {booking.status === "declined" && booking.decline_reason ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Provider's note: {booking.decline_reason}
            </p>
          ) : null}

          {cancelable ? (
            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                You can cancel while this is awaiting the provider — your card hasn't been charged,
                and any hold is released immediately.
              </p>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-5">
          {captured ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/receipt?booking=${encodeURIComponent(booking.id)}`}>
                <ReceiptText className="h-3.5 w-3.5" />
                View receipt
              </Link>
            </Button>
          ) : null}

          {cancelable ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={cancel.isPending}>
                  {cancel.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  Cancel booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    We'll withdraw your request to {provName} and release the hold on your card. You
                    haven't been charged. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep booking</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancel booking
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
