import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Clock3, CheckCircle2, XCircle, ShieldCheck, ChevronRight } from "lucide-react";
import { useMyBookings, type BookingView } from "@/hooks/useBookings";
import { BookingRow } from "@/components/services/BookingRow";
import { BookingDetailDialog } from "@/components/services/BookingDetailDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isPendingRequest } from "@/lib/services";

// The buyer's view of the authorize-not-charge lifecycle:
//   pending review (authorized, not charged) → confirmed/captured (paid) → declined (released)
function LifecycleBadge({ booking }: { booking: BookingView }) {
  const captured = booking.payment_status === "captured";
  const status = booking.status;

  if (status === "declined" || status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <XCircle className="h-3.5 w-3.5" />
        Declined (not charged)
      </span>
    );
  }
  if (captured || status === "confirmed" || status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green/15 px-3 py-1 text-xs font-semibold text-green">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Confirmed &amp; paid
      </span>
    );
  }
  if (isPendingRequest(status) || booking.payment_status === "authorized") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
        <Clock3 className="h-3.5 w-3.5" />
        Awaiting provider · not charged
      </span>
    );
  }
  return null;
}

export default function MyBookings() {
  const { data: bookings, isLoading } = useMyBookings();
  const list = bookings ?? [];
  const [selected, setSelected] = useState<BookingView | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (b: BookingView) => {
    setSelected(b);
    setDetailOpen(true);
  };

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <CalendarCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">My bookings</h1>
          <p className="text-sm text-muted-foreground">Services you’ve requested from providers.</p>
        </div>
      </header>

      <div className="mb-8 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Your card is <span className="font-semibold">authorized</span> when you request a booking,
          but you’re only charged once the provider <span className="font-semibold">accepts</span>.
          If they decline, the hold is released automatically.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No bookings yet"
          description="Browse providers and request your first service."
          action={
            <Button asChild>
              <Link to="/services">Browse services</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {list.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              role="customer"
              showPayment
              actions={
                <>
                  <LifecycleBadge booking={b} />
                  <Button size="sm" variant="outline" onClick={() => openDetail(b)}>
                    View details
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <BookingDetailDialog booking={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
