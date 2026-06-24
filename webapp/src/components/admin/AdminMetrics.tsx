import { Users, CalendarDays, Sparkles, CalendarCheck, Ticket } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminMetrics } from "@/hooks/useAdmin";

const CARDS = [
  { key: "users", label: "Total users", icon: Users },
  { key: "events", label: "Total events", icon: CalendarDays },
  { key: "providers", label: "Total providers", icon: Sparkles },
  { key: "bookings", label: "Total bookings", icon: CalendarCheck },
  { key: "ticketsSold", label: "Tickets sold", icon: Ticket },
] as const;

export function AdminMetrics() {
  const { data, isLoading } = useAdminMetrics();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => (
        <div key={c.key} className="rounded-2xl border border-border bg-card p-4">
          <c.icon className="h-5 w-5 text-primary" />
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-16" />
          ) : (
            <p className="mt-3 font-heading text-3xl font-extrabold">{data?.[c.key] ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
