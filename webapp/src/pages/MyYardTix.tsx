import { useMemo } from "react";
import { Ticket } from "lucide-react";
import { useMyYardTix, useCancelYardTix } from "@/hooks/useMyYardTix";
import { YardTixCard } from "@/components/yardtix/YardTixCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { isPastDate } from "@/lib/helpers";
import { toast } from "sonner";

export default function MyYardTix() {
  const navigate = useNavigate();
  const { data: tix, isLoading } = useMyYardTix();
  const cancel = useCancelYardTix();

  const { upcoming, past } = useMemo(() => {
    const all = tix ?? [];
    return {
      upcoming: all.filter((t) => !isPastDate(t.event?.date ?? null)),
      past: all.filter((t) => isPastDate(t.event?.date ?? null)),
    };
  }, [tix]);

  function handleCancel(id: string) {
    cancel.mutate(id, {
      onSuccess: () => toast.success("Removed from your YardTix"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not cancel"),
    });
  }

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold md:text-4xl">My YardTix</h1>
        <p className="mt-2 text-muted-foreground">
          Your tickets and RSVPs — show the code at the door.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (tix ?? []).length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No YardTix yet"
          description="RSVP to a free event or reserve tickets and they’ll appear here."
          action={<Button onClick={() => navigate("/events")}>Browse events</Button>}
        />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-heading text-lg font-bold">Upcoming</h2>
              {upcoming.map((t) => (
                <YardTixCard
                  key={t.id}
                  tix={t}
                  onCancel={t.kind === "rsvp" ? handleCancel : undefined}
                  canceling={cancel.isPending}
                />
              ))}
            </section>
          ) : null}

          {past.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-heading text-lg font-bold text-muted-foreground">Past</h2>
              <div className="space-y-4 opacity-75">
                {past.map((t) => (
                  <YardTixCard key={t.id} tix={t} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
