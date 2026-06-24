import { Share2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { YardEvent } from "@/lib/types";
import { toast } from "sonner";

export function EventActions({ event }: { event: YardEvent }) {
  async function share() {
    const url = window.location.href;
    const data = { title: event.title ?? "YardLine event", text: "Check out this event on YardLine", url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  function report() {
    // Placeholder for Phase 2 — moderation tooling comes later.
    toast.success("Thanks — this event has been flagged for review.");
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={share} className="gap-1.5">
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      <Button variant="ghost" size="sm" onClick={report} className="gap-1.5 text-muted-foreground">
        <Flag className="h-4 w-4" />
        Report
      </Button>
    </div>
  );
}
