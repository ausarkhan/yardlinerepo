import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PriceBreakdown } from "./PriceBreakdown";
import { appOrigin } from "@/lib/stripeClient";

interface BookingPaymentFormProps {
  bookingId: string;
  servicePriceCents: number;
  onAuthorized: () => void;
}

// The card-collection step. Mounted INSIDE an <Elements> provider that already
// holds the booking's client_secret. Manual-capture: confirmPayment leaves the
// intent in `requires_capture` (authorized, NOT charged) — a no-error result is
// success. The provider captures later by accepting the booking.
export function BookingPaymentForm({
  bookingId,
  servicePriceCents,
  onAuthorized,
}: BookingPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Please check your card details.");
      setSubmitting(false);
      return;
    }

    const returnUrl = `${appOrigin()}/receipt?booking=${encodeURIComponent(bookingId)}`;
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "We couldn’t authorize your card.");
      setSubmitting(false);
      return;
    }

    // No error and no redirect → manual-capture authorization succeeded.
    setSubmitting(false);
    onAuthorized();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground">
          Your card will be <span className="font-semibold">authorized now</span>, but you won’t be
          charged until the provider accepts your booking request.
        </AlertDescription>
      </Alert>

      <PriceBreakdown priceCents={servicePriceCents} />

      <div className="rounded-xl border border-border bg-card p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : null}

      <Button type="submit" disabled={!stripe || submitting} className="w-full font-semibold">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Authorize card
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Secured by Stripe. The hold is released automatically if the provider declines.
      </p>
    </form>
  );
}
