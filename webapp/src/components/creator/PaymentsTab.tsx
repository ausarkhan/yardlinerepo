import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConnectStatus, useConnectOnboarding } from "@/hooks/useStripeConnect";
import { useCreatorRevenue } from "@/hooks/useCreatorRevenue";
import { connectStatusLabel, connectStatusStyle } from "@/lib/stripeConnect";
import { paymentStatusLabel, paymentStatusStyle } from "@/lib/services";
import { formatPrice } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { Ticket, Clock3 } from "lucide-react";
import { toast } from "sonner";

function RevenueCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
  accent?: "green" | "primary" | "muted";
}) {
  const tone =
    accent === "green"
      ? "text-green"
      : accent === "primary"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4", tone)} />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 font-heading text-2xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function Capability({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-sm font-medium">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">{ok ? "Enabled" : "Off"}</span>
    </div>
  );
}

export function PaymentsTab() {
  const { data: connect, isLoading, refetch } = useConnectStatus();
  const { data: revenue } = useCreatorRevenue();
  const onboarding = useConnectOnboarding();
  const [params, setParams] = useSearchParams();

  // Returning from Stripe-hosted onboarding — refresh status and clean the URL.
  useEffect(() => {
    const flag = params.get("connect");
    if (!flag) return;
    if (flag === "return") toast.success("Welcome back — syncing your payment status…");
    refetch();
    const next = new URLSearchParams(params);
    next.delete("connect");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  const status = connect?.status ?? "not_activated";
  const isActive = status === "active";
  const lastUpdated = connect?.updated_at ? new Date(connect.updated_at).toLocaleString() : "—";

  const ctaLabel =
    status === "not_activated"
      ? "Activate Payments"
      : status === "active"
        ? "Manage on Stripe"
        : "Continue onboarding";

  function activate() {
    onboarding.mutate(undefined, {
      onSuccess: (res) => {
        if (!res.url) {
          toast.error(res.message ?? "Couldn’t start Stripe onboarding.");
        }
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Couldn’t start Stripe onboarding."),
    });
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                isActive ? "bg-green/15 text-green" : "bg-primary/15 text-primary",
              )}
            >
              <CreditCard className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold">Payments</h2>
                <Badge variant="outline" className={cn("border", connectStatusStyle(status))}>
                  {connectStatusLabel(status)}
                </Badge>
                {connect?.test_mode ? (
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    Test mode
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isActive
                  ? "You’re all set to receive payouts through Stripe Connect."
                  : "Connect a Stripe account to accept paid tickets and bookings."}
              </p>
            </div>
          </div>
          <Button
            onClick={activate}
            disabled={onboarding.isPending}
            className="h-11 font-semibold"
            variant={isActive ? "outline" : "default"}
          >
            {onboarding.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isActive ? (
              <ExternalLink className="h-4 w-4" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {ctaLabel}
          </Button>
        </div>
      </div>

      {/* Connect not enabled / other backend message */}
      {connect?.message ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{connect.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* Capabilities */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Capability ok={!!connect?.charges_enabled} label="Charges enabled" />
        <Capability ok={!!connect?.payouts_enabled} label="Payouts enabled" />
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</dt>
              <dd className="font-medium">
                {connect?.details_submitted ? "Details submitted" : "Not submitted"}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Last update</dt>
              <dd className="font-medium">{lastUpdated}</dd>
            </div>
          </div>
        </dl>
      </div>

      {/* Revenue */}
      <div className="space-y-3">
        <h3 className="font-heading text-lg font-bold">Revenue</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <RevenueCard
            icon={Ticket}
            label="Ticket revenue"
            value={formatPrice(revenue?.ticketRevenueCents ?? 0)}
            accent="primary"
          />
          <RevenueCard
            icon={Banknote}
            label="Service revenue"
            value={formatPrice(revenue?.serviceRevenueCents ?? 0)}
            accent="green"
          />
          <RevenueCard
            icon={Clock3}
            label="Pending bookings"
            value={formatPrice(revenue?.pendingBookingRevenueCents ?? 0)}
            accent="muted"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Ticket revenue is your share (excludes the platform fee). Service revenue counts captured
          bookings; pending counts authorized holds awaiting your approval.
        </p>
      </div>

      {/* Recent transactions */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 font-heading text-lg font-bold">Recent transactions</h3>
        {!revenue || revenue.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions yet. Ticket sales and bookings will appear here as they happen.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {revenue.recent.map((t) => (
              <div key={`${t.kind}-${t.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      t.kind === "ticket" ? "bg-primary/15 text-primary" : "bg-secondary/15 text-secondary",
                    )}
                  >
                    {t.kind === "ticket" ? (
                      <Ticket className="h-4 w-4" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={cn("border", paymentStatusStyle(t.payment_status))}>
                    {paymentStatusLabel(t.payment_status)}
                  </Badge>
                  <span className="font-heading text-sm font-bold">{formatPrice(t.amount_cents)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        YardLine uses Stripe Connect so hosts and providers get paid directly. You can revisit
        onboarding here any time your account needs attention.
      </p>
    </div>
  );
}
