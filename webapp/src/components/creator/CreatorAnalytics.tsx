import { useMemo } from "react";
import {
  CalendarCheck,
  Wrench,
  Inbox,
  CalendarClock,
  Ticket,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { useHostEvents } from "@/hooks/useHostEvents";
import { useMyServices } from "@/hooks/useProviderProfile";
import { useProviderBookings } from "@/hooks/useBookings";
import { useConnectStatus } from "@/hooks/useStripeConnect";
import { useCreatorRevenue } from "@/hooks/useCreatorRevenue";
import { isPendingRequest, isUpcoming } from "@/lib/services";
import { connectStatusLabel } from "@/lib/stripeConnect";
import { formatPrice } from "@/lib/helpers";
import { cn } from "@/lib/utils";

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Ticket;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4", accent ? "text-primary" : "")} />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 font-heading text-2xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

// Lightweight dashboard metrics — organization over full financial reporting.
export function CreatorAnalytics() {
  const { data: hostData } = useHostEvents();
  const { data: services } = useMyServices();
  const { data: bookings } = useProviderBookings();
  const { data: connect } = useConnectStatus();
  const { data: revenue } = useCreatorRevenue();

  const m = useMemo(() => {
    const events = hostData?.events ?? [];
    const stats = hostData?.stats ?? {};
    const activeEvents = events.filter((e) => e.status === "published").length;
    const ticketsSold = Object.values(stats).reduce((sum, s) => sum + s.tickets, 0);
    const activeServices = (services ?? []).filter((s) => s.active).length;
    const pending = (bookings ?? []).filter((b) => isPendingRequest(b.status)).length;
    const upcoming = (bookings ?? []).filter((b) => isUpcoming(b.status)).length;
    return { activeEvents, ticketsSold, activeServices, pending, upcoming };
  }, [hostData, services, bookings]);

  const totalRevenueCents =
    (revenue?.ticketRevenueCents ?? 0) + (revenue?.serviceRevenueCents ?? 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <Metric icon={CalendarCheck} label="Active events" value={m.activeEvents} accent />
      <Metric icon={Wrench} label="Active services" value={m.activeServices} accent />
      <Metric icon={Inbox} label="Pending" value={m.pending} />
      <Metric icon={CalendarClock} label="Upcoming" value={m.upcoming} />
      <Metric icon={Ticket} label="Tickets sold" value={m.ticketsSold} />
      <Metric icon={DollarSign} label="Revenue" value={formatPrice(totalRevenueCents)} accent />
      <Metric
        icon={CreditCard}
        label="Payments"
        value={connectStatusLabel(connect?.status ?? "not_activated")}
      />
    </div>
  );
}
