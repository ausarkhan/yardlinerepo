import type { LucideIcon } from "lucide-react";
import { Star, CheckCircle2, CalendarDays, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReputationStat {
  icon: LucideIcon;
  label: string;
  value: string;
}

// Compact trust indicators shown on provider pages, the creator dashboard, and
// event pages. Pass pre-built stats, or use the helpers below.
export function ReputationBadges({ stats, className }: { stats: ReputationStat[]; className?: string }) {
  if (stats.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
        >
          <s.icon className="h-4 w-4 text-primary" />
          <div className="leading-tight">
            <p className="text-sm font-bold">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function providerStats(rep: {
  rating: number;
  reviewCount: number;
  completedBookings: number;
}): ReputationStat[] {
  return [
    { icon: Star, label: "Avg rating", value: rep.rating > 0 ? `${rep.rating.toFixed(1)}/10` : "New" },
    { icon: CheckCircle2, label: "Completed bookings", value: String(rep.completedBookings) },
    { icon: Users, label: "Reviews", value: String(rep.reviewCount) },
  ];
}

export function hostStats(rep: {
  rating: number;
  reviewCount: number;
  eventsHosted: number;
  attendeesServed: number;
}): ReputationStat[] {
  return [
    { icon: Star, label: "Avg event rating", value: rep.rating > 0 ? `${rep.rating.toFixed(1)}/10` : "New" },
    { icon: CalendarDays, label: "Events hosted", value: String(rep.eventsHosted) },
    { icon: Users, label: "Attendees served", value: String(rep.attendeesServed) },
  ];
}
