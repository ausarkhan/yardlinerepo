import { CheckCircle2, AlertTriangle, XCircle, User, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  checkinResultLabel,
  checkinResultTone,
  type CheckinScanResponse,
} from "@/lib/checkin";
import { formatEventDate } from "@/lib/helpers";

interface CheckinResultProps {
  result: CheckinScanResponse | null;
}

const TONE = {
  success: {
    wrap: "border-green/40 bg-green/10 text-green",
    icon: CheckCircle2,
  },
  warning: {
    wrap: "border-primary/40 bg-primary/10 text-primary",
    icon: AlertTriangle,
  },
  error: {
    wrap: "border-destructive/40 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
} as const;

// The most recent scan outcome, driven entirely by response.result.
export function CheckinResult({ result }: CheckinResultProps) {
  if (!result) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
        Scan a QR code or enter a ticket number to see the result here.
      </div>
    );
  }

  const tone = checkinResultTone(result.result);
  const { wrap, icon: Icon } = TONE[tone];
  const ticket = result.ticket;
  const usedAt =
    result.result === "already_used" && ticket?.used_at
      ? formatEventDate(ticket.used_at, { withYear: true })
      : null;

  return (
    <div className={cn("rounded-2xl border p-5", wrap)}>
      <div className="flex items-center gap-2.5">
        <Icon className="h-6 w-6 shrink-0" />
        <p className="font-heading text-lg font-bold">{checkinResultLabel(result.result)}</p>
      </div>

      {result.message ? (
        <p className="mt-1.5 text-sm opacity-90">{result.message}</p>
      ) : null}

      {ticket ? (
        <div className="mt-3 space-y-1.5 border-t border-current/15 pt-3 text-sm text-foreground">
          {ticket.holder_name ? (
            <p className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4 opacity-70" />
              {ticket.holder_name}
            </p>
          ) : null}
          <p className="flex items-center gap-2">
            <Ticket className="h-4 w-4 opacity-70" />
            <span className="font-mono">{ticket.ticket_number}</span>
            {ticket.tier_name ? (
              <span className="text-muted-foreground">· {ticket.tier_name}</span>
            ) : null}
          </p>
          {usedAt ? (
            <p className="text-xs text-muted-foreground">Already checked in at {usedAt}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
