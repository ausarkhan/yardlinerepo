import { useCallback, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, ScanLine } from "lucide-react";
import { useEvent } from "@/hooks/useEvents";
import { useAuthStore } from "@/store/auth";
import { useCheckinSummary, useScanTicket } from "@/hooks/useCheckin";
import { QrScanner } from "@/components/checkin/QrScanner";
import { ManualEntry } from "@/components/checkin/ManualEntry";
import { CheckinResult } from "@/components/checkin/CheckinResult";
import { CheckinRoster } from "@/components/checkin/CheckinRoster";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { checkinResultLabel, type CheckinScanResponse } from "@/lib/checkin";
import { toast } from "sonner";

// Ignore the same scanned token if it re-fires within this window (zxing emits
// continuously while a code is in frame).
const DUPLICATE_WINDOW_MS = 3000;

export default function EventCheckin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const isHost = !!userId && !!event && event.host_id === userId;

  const summary = useCheckinSummary(id, isHost);
  const scan = useScanTicket(id);

  const [lastResult, setLastResult] = useState<CheckinScanResponse | null>(null);

  // De-dupe rapid repeat scans of the same token.
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);

  const submitScan = useCallback(
    (body: { qr_token?: string; ticket_number?: string }) => {
      if (!id) return;
      scan.mutate(
        { ...body, event_id: id },
        {
          onSuccess: (res) => {
            setLastResult(res);
            const label = checkinResultLabel(res.result);
            const name = res.ticket?.holder_name ?? res.ticket?.ticket_number ?? "";
            if (res.result === "ok") toast.success(`${label}${name ? ` · ${name}` : ""}`);
            else if (res.result === "already_used") toast.warning(`${label}${name ? ` · ${name}` : ""}`);
            else toast.error(res.message ?? label);
          },
          onError: (e) =>
            toast.error(e instanceof Error ? e.message : "Check-in failed. Try again."),
        },
      );
    },
    [id, scan],
  );

  const handleDecode = useCallback(
    (text: string) => {
      const token = text.trim();
      if (!token) return;
      const prev = lastTokenRef.current;
      const now = Date.now();
      if (prev && prev.token === token && now - prev.at < DUPLICATE_WINDOW_MS) return;
      lastTokenRef.current = { token, at: now };
      submitScan({ qr_token: token });
    },
    [submitScan],
  );

  if (eventLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={ScanLine}
          title="Event not found"
          description="This event may have been removed."
          action={<Button onClick={() => navigate("/creator-dashboard?tab=events")}>Back to dashboard</Button>}
        />
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={Lock}
          title="Host access only"
          description="Only the host of this event can run check-in."
          action={<Button onClick={() => navigate(`/event/${event.id}`)}>View event</Button>}
        />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 md:py-8">
      <Link
        to={`/event/${event.id}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to event
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
          <ScanLine className="h-7 w-7 text-primary" />
          Check-in
        </h1>
        <p className="mt-1 text-muted-foreground">{event.title}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner + manual entry + result */}
        <div className="space-y-5">
          <QrScanner onDecode={handleDecode} paused={scan.isPending} />
          <ManualEntry
            onSubmit={(ticketNumber) => submitScan({ ticket_number: ticketNumber })}
            pending={scan.isPending}
          />
          <CheckinResult result={lastResult} />
        </div>

        {/* Live roster */}
        <CheckinRoster summary={summary.data} isLoading={summary.isLoading} />
      </div>
    </div>
  );
}
