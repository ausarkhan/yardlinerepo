import { Clock, Sparkles, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import type { Service } from "@/lib/types";
import { formatPrice } from "@/lib/helpers";

interface ServiceListProps {
  services: Service[];
  // When provided, each service shows a working "Book" button.
  onBook?: (service: Service) => void;
  emptyDescription?: string;
}

export function ServiceList({ services, onBook, emptyDescription }: ServiceListProps) {
  if (services.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No services listed yet"
        description={
          emptyDescription ??
          "This provider hasn’t published their service menu yet. Check back soon."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {services.map((s) => (
        <div
          key={s.service_id}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
        >
          <div className="min-w-0">
            <p className="font-semibold">{s.name ?? "Service"}</p>
            {s.description ? (
              <p className="line-clamp-1 text-sm text-muted-foreground">{s.description}</p>
            ) : null}
            {s.duration ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {s.duration} min
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="font-heading text-lg font-bold">{formatPrice(s.price_cents)}</span>
            {onBook ? (
              <Button size="sm" onClick={() => onBook(s)}>
                <CalendarPlus className="h-3.5 w-3.5" />
                Book
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
