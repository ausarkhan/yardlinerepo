import { Link, useSearchParams } from "react-router-dom";
import {
  ReceiptText,
  Loader2,
  CheckCircle2,
  Clock3,
  Ticket as TicketIcon,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/common/EmptyState";
import { useTicketReceipt, useBookingReceipt } from "@/hooks/useReceipt";
import {
  formatPrice,
  formatEventDate,
  formatEventTime,
  providerName as providerNameOf,
} from "@/lib/helpers";
import { paymentStatusLabel, paymentStatusStyle } from "@/lib/services";
import { cn } from "@/lib/utils";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium", mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container max-w-2xl py-8 md:py-12">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ReceiptText className="h-4 w-4" />
        Receipt
      </Link>
      {children}
    </div>
  );
}

function Processing({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Loader2 className="h-7 w-7 animate-spin" />
      </span>
      <h1 className="font-heading text-xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TicketReceiptView({ orderId }: { orderId: string }) {
  const { statusQuery, receiptQuery, isPaid } = useTicketReceipt(orderId);

  if (statusQuery.isLoading || (!isPaid && !statusQuery.data)) {
    return <Processing title="Loading your receipt…" note="Hang tight while we fetch your order." />;
  }

  if (!isPaid) {
    return (
      <Processing
        title="Finalizing payment…"
        note="Your payment is processing. Your tickets are being minted and will appear here in a few seconds."
      />
    );
  }

  const data = receiptQuery.data;
  const status = statusQuery.data;

  // Paid, but the rich order tables aren't available yet (migration not applied).
  if (receiptQuery.isLoading) {
    return <Processing title="Almost there…" note="Pulling up your ticket details." />;
  }

  const order = data?.order ?? null;
  const tickets = data?.tickets ?? [];
  const event = data?.event ?? null;
  const buyerName = data?.buyer?.name?.trim() || "You";
  const hostName = data?.host?.name?.trim() || event?.host_data?.name?.trim() || "Host";

  const subtotal = order?.subtotal_cents ?? null;
  const fee = order?.fee_cents ?? null;
  const total = order?.total_cents ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-green/30 bg-green/5 p-6 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green/15 text-green">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="font-heading text-2xl font-extrabold">Payment confirmed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {(status?.ticket_count ?? tickets.length) || tickets.length} ticket
          {(status?.ticket_count ?? tickets.length) === 1 ? "" : "s"} for {event?.title ?? "your event"}.
        </p>
      </div>

      {!order ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Your payment is confirmed. Full receipt details are being processed and will be available
          shortly — your tickets are already in{" "}
          <Link to="/my-yardtix" className="font-medium text-primary hover:underline">
            My YardTix
          </Link>
          .
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold">Order summary</h2>
            <Badge variant="outline" className="border-green/30 bg-green/15 text-green">
              Paid
            </Badge>
          </div>
          <Row label="Receipt number" value={order.order_number ?? order.id} mono />
          <Row label="Event" value={event?.title ?? "Event"} />
          <Row label="Customer" value={buyerName} />
          <Row label="Host" value={hostName} />
          {order.created_at ? (
            <Row label="Payment date" value={new Date(order.created_at).toLocaleString()} />
          ) : null}
          <Separator className="my-3" />
          {subtotal != null ? <Row label="Tickets (subtotal)" value={formatPrice(subtotal)} /> : null}
          {fee != null ? <Row label="Service fee" value={formatPrice(fee)} /> : null}
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total paid</span>
            <span className="font-heading text-xl font-bold">
              {total != null ? formatPrice(total) : "—"}
            </span>
          </div>
        </div>
      )}

      {tickets.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold">
            <TicketIcon className="h-5 w-5 text-primary" />
            Your tickets
          </h2>
          <div className="space-y-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="font-mono">{t.ticket_number ?? t.id}</span>
                {t.tier_name ? (
                  <span className="text-muted-foreground">{t.tier_name}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="font-semibold">
          <Link to="/my-yardtix">
            View My YardTix
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        {status?.receipt_url ? (
          <Button asChild variant="outline">
            <a href={status.receipt_url} target="_blank" rel="noreferrer">
              Stripe receipt
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BookingReceiptView({ bookingId }: { bookingId: string }) {
  const { data, isLoading } = useBookingReceipt(bookingId);

  if (isLoading) {
    return <Processing title="Loading your receipt…" note="Fetching your booking details." />;
  }

  const booking = data?.booking ?? null;
  if (!booking) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Booking not found"
        description="We couldn’t find this booking. It may have been removed."
        action={
          <Button asChild>
            <Link to="/my-bookings">My bookings</Link>
          </Button>
        }
      />
    );
  }

  const service = data?.service ?? null;
  const providerName = data?.provider ? providerNameOf(data.provider) : "Provider";
  const customerName = data?.customer?.name?.trim() || "You";
  const captured = booking.payment_status === "captured";
  const declined = booking.status === "declined" || booking.status === "cancelled";

  const headline = captured
    ? "Confirmed & paid"
    : declined
      ? "Declined — not charged"
      : "Card authorized — awaiting approval";

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-2xl border p-6 text-center",
          captured ? "border-green/30 bg-green/5" : declined ? "border-border bg-muted/40" : "border-primary/30 bg-primary/5",
        )}
      >
        <span
          className={cn(
            "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full",
            captured ? "bg-green/15 text-green" : declined ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
          )}
        >
          {captured ? <CheckCircle2 className="h-7 w-7" /> : <Clock3 className="h-7 w-7" />}
        </span>
        <h1 className="font-heading text-2xl font-extrabold">{headline}</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {captured
            ? `Your payment to ${providerName} is complete.`
            : declined
              ? "The provider declined this request. Your authorization hold has been released — you were not charged."
              : "You have NOT been charged yet. The provider will be charged-out only if they accept."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">Booking summary</h2>
          <Badge variant="outline" className={cn("border", paymentStatusStyle(booking.payment_status))}>
            {paymentStatusLabel(booking.payment_status)}
          </Badge>
        </div>
        <Row label="Receipt number" value={booking.id} mono />
        <Row label="Service" value={service?.name ?? "Service"} />
        <Row label="Provider" value={providerName} />
        <Row label="Customer" value={customerName} />
        <Row
          label="Date & time"
          value={`${formatEventDate(booking.date, { withYear: true })}${
            booking.time_start ? ` · ${formatEventTime(booking.time_start)}` : ""
          }`}
        />
        {booking.created_at ? (
          <Row label="Requested" value={new Date(booking.created_at).toLocaleString()} />
        ) : null}
        <Separator className="my-3" />
        <Row label="Service price" value={formatPrice(booking.service_price_cents)} />
        <Row label="Platform fee" value={formatPrice(booking.platform_fee_cents)} />
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <span className="font-semibold">{captured ? "Total paid" : "Authorized total"}</span>
          <span className="font-heading text-xl font-bold">{formatPrice(booking.amount_total)}</span>
        </div>
      </div>

      {!captured && !declined ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          The hold is released automatically if the provider declines.
        </p>
      ) : null}

      <Button asChild className="font-semibold">
        <Link to="/my-bookings">
          <CalendarDays className="h-4 w-4" />
          My bookings
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Receipt() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const bookingId = params.get("booking");

  return (
    <Shell>
      {orderId ? (
        <TicketReceiptView orderId={orderId} />
      ) : bookingId ? (
        <BookingReceiptView bookingId={bookingId} />
      ) : (
        <EmptyState
          icon={ReceiptText}
          title="No receipt selected"
          description="Open a receipt from My YardTix or My Bookings."
          action={
            <Button asChild>
              <Link to="/">Go home</Link>
            </Button>
          }
        />
      )}
    </Shell>
  );
}
