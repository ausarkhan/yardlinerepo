import { Check, Users, Loader2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEventCapacity, useMyAttendance, useTicketingActions } from "@/hooks/useTicketing";
import { useAuthStore } from "@/store/auth";
import type { YardEvent } from "@/lib/types";
import { toast } from "sonner";

export function RsvpCard({ event }: { event: YardEvent }) {
  const user = useAuthStore((s) => s.user);
  const { data: capacity } = useEventCapacity(event.id);
  const { data: mine } = useMyAttendance(event.id);
  const { rsvp, cancelRsvp } = useTicketingActions(event);

  const going = (mine ?? []).some((r) => r.source === "rsvp");
  const total = capacity?.total ?? event.rsvp_count ?? 0;
  const cap = event.max_tickets ?? null;
  const full = cap != null && total >= cap && !going;

  function toggle() {
    if (!user) {
      toast.error("Please sign in to RSVP.");
      return;
    }
    const action = going ? cancelRsvp : rsvp;
    action.mutate(undefined, {
      onSuccess: () => toast.success(going ? "RSVP removed" : "You’re going! 🎉"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update RSVP"),
    });
  }

  const busy = rsvp.isPending || cancelRsvp.isPending;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-green/15 px-3 py-1 text-sm font-semibold text-green">
          <PartyPopper className="h-4 w-4" />
          Free event
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {total} going
        </span>
      </div>

      {cap != null ? (
        <div className="mt-4 space-y-1.5">
          <Progress value={Math.min(100, (total / cap) * 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {Math.max(0, cap - total)} of {cap} spots left
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        RSVP to let the host know you’re coming — it’ll show up in your YardTix.
      </p>

      <Button
        onClick={toggle}
        disabled={busy || full}
        variant={going ? "outline" : "default"}
        className="mt-5 h-12 w-full text-base font-semibold"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : going ? (
          <>
            <Check className="h-5 w-5" />
            You’re going
          </>
        ) : full ? (
          "At capacity"
        ) : (
          "RSVP now"
        )}
      </Button>
    </div>
  );
}
