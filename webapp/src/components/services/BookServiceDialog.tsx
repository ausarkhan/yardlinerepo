import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Elements } from "@stripe/react-stripe-js";
import { CalendarDays, Clock, Loader2, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PriceBreakdown } from "./PriceBreakdown";
import { BookingPaymentForm } from "./BookingPaymentForm";
import { useAuthStore } from "@/store/auth";
import { createBookingIntent } from "@/lib/checkout";
import { getStripe, isStripeConfigured } from "@/lib/stripeClient";
import type { Service, ServiceProvider } from "@/lib/types";
import { providerName, formatPrice } from "@/lib/helpers";
import { toast } from "sonner";

interface BookServiceDialogProps {
  provider: ServiceProvider;
  services: Service[];
  initialServiceId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type Step = "details" | "pay" | "done";

export function BookServiceDialog({
  provider,
  services,
  initialServiceId,
  open,
  onOpenChange,
}: BookServiceDialogProps) {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const [serviceId, setServiceId] = useState<string>(initialServiceId ?? services[0]?.service_id ?? "");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");

  const [step, setStep] = useState<Step>("details");
  const [starting, setStarting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [servicePriceCents, setServicePriceCents] = useState<number>(0);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const stripeReady = isStripeConfigured();

  // Reset everything whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setServiceId(initialServiceId ?? services[0]?.service_id ?? "");
      setDate("");
      setTime("");
      setStep("details");
      setStarting(false);
      setClientSecret(null);
      setBookingId(null);
      setServicePriceCents(0);
      setBlockedMessage(null);
    }
  }, [open, initialServiceId, services]);

  const service = useMemo(
    () => services.find((s) => s.service_id === serviceId) ?? null,
    [services, serviceId],
  );

  const providerUserId = provider.user_id ?? "";

  async function startPayment() {
    if (!userId) {
      toast.error("Please sign in to book.");
      return;
    }
    if (!service) {
      toast.error("Choose a service to book.");
      return;
    }
    if (!date) {
      toast.error("Pick a date.");
      return;
    }
    if (!time) {
      toast.error("Pick a start time.");
      return;
    }
    if (!stripeReady) {
      setBlockedMessage("Online payments aren’t enabled yet, so this provider can’t take bookings right now.");
      return;
    }

    setStarting(true);
    setBlockedMessage(null);
    try {
      const res = await createBookingIntent({
        service_id: service.service_id,
        provider_user_id: providerUserId,
        date,
        time_start: `${time}:00`,
      });
      if (!res.client_secret) {
        setBlockedMessage(res.message ?? "This provider can’t take paid bookings yet.");
        setStarting(false);
        return;
      }
      setClientSecret(res.client_secret);
      setBookingId(res.booking_id);
      setServicePriceCents(res.service_price_cents);
      setStep("pay");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
    } finally {
      setStarting(false);
    }
  }

  function onAuthorized() {
    setStep("done");
    qc.invalidateQueries({ queryKey: ["my-bookings", userId] });
    qc.invalidateQueries({ queryKey: ["provider-bookings"] });
  }

  function goToBookings() {
    onOpenChange(false);
    navigate("/my-bookings");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (starting ? null : onOpenChange(o))}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book {providerName(provider)}</DialogTitle>
          <DialogDescription>
            {step === "details"
              ? "Pick a service and time, then authorize your card."
              : step === "pay"
                ? "Authorize your card to send the request."
                : "Request sent."}
          </DialogDescription>
        </DialogHeader>

        {step === "details" ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.service_id} value={s.service_id}>
                        {s.name ?? "Service"} — {formatPrice(s.price_cents)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {service?.duration ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    About {service.duration} min
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="booking-date">Date</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="booking-date"
                      type="date"
                      min={todayISO()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-time">Start time</Label>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="booking-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {service ? <PriceBreakdown priceCents={service.price_cents ?? 0} /> : null}

              {blockedMessage ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Payments unavailable</AlertTitle>
                  <AlertDescription>{blockedMessage}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={startPayment}
                disabled={starting || !stripeReady}
                className="w-full font-semibold"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue to payment
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Your card is authorized now — you’re only charged if the provider accepts.
              </p>
            </DialogFooter>
          </>
        ) : null}

        {step === "pay" && clientSecret && bookingId ? (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <BookingPaymentForm
              bookingId={bookingId}
              servicePriceCents={servicePriceCents}
              onAuthorized={onAuthorized}
            />
          </Elements>
        ) : null}

        {step === "done" ? (
          <div className="space-y-4 py-2 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green/15 text-green">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <div className="space-y-1">
              <p className="font-heading text-lg font-bold">Card authorized</p>
              <p className="text-sm text-muted-foreground">
                Awaiting provider approval. You have <span className="font-semibold">NOT</span> been
                charged yet. If the provider declines, the hold is released.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={goToBookings} className="w-full font-semibold">
                View my bookings
              </Button>
              {bookingId ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/receipt?booking=${encodeURIComponent(bookingId)}`);
                  }}
                  className="w-full"
                >
                  See receipt
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
