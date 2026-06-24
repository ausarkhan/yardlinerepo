import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  Pencil,
  ExternalLink,
  Inbox,
  Wrench,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useMyProviderProfile, useMyServices } from "@/hooks/useProviderProfile";
import { useProviderBookings, useBookingActions, type BookingView } from "@/hooks/useBookings";
import { useConnectStatus } from "@/hooks/useStripeConnect";
import { ServiceManageRow } from "@/components/services/ServiceManageRow";
import { ServiceEditorDialog } from "@/components/services/ServiceEditorDialog";
import { BookingRow } from "@/components/services/BookingRow";
import { ProviderProfileForm } from "@/components/creator/ProviderProfileForm";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  setProviderAvailability,
  isPendingRequest,
  isUpcoming,
  isMissingStatusMigration,
} from "@/lib/services";
import { canAcceptPaidBooking, paymentsActive } from "@/lib/creatorGating";
import type { Service } from "@/lib/types";
import { toast } from "sonner";

interface ServicesTabProps {
  onActivatePayments: () => void;
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Inbox; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 font-heading text-2xl font-extrabold">{value}</p>
    </div>
  );
}

export function ServicesTab({ onActivatePayments }: ServicesTabProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const { data: provider, isLoading: loadingProvider } = useMyProviderProfile();
  const { data: services, isLoading: loadingServices } = useMyServices();
  const { data: bookings, isLoading: loadingBookings } = useProviderBookings();
  const { data: connect } = useConnectStatus();
  const { updateStatus, accept: acceptMutation, decline: declineMutation } = useBookingActions();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const availability = useMutation({
    mutationFn: (next: boolean) => {
      if (!provider) throw new Error("No provider profile");
      return setProviderAvailability(provider.id, next);
    },
    onSuccess: (_r, next) => {
      qc.invalidateQueries({ queryKey: ["my-provider", userId] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success(next ? "You’re accepting bookings" : "Bookings paused");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const requests = useMemo(
    () => (bookings ?? []).filter((b) => isPendingRequest(b.status)),
    [bookings],
  );
  const upcoming = useMemo(() => (bookings ?? []).filter((b) => isUpcoming(b.status)), [bookings]);
  const confirmedCount = (bookings ?? []).filter((b) => b.status === "confirmed").length;

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(service: Service) {
    setEditing(service);
    setEditorOpen(true);
  }

  function accept(b: BookingView) {
    const gate = canAcceptPaidBooking(b.service, connect);
    if (!gate.ok) {
      toast.error(gate.reason ?? "Activate payments to accept paid bookings.");
      return;
    }
    // Server captures the held funds (authorized → captured).
    acceptMutation.mutate(b.id, {
      onSuccess: () => toast.success("Booking accepted — payment captured"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not accept"),
    });
  }

  function decline(b: BookingView) {
    // Server releases the authorization (the customer's hold is returned).
    declineMutation.mutate(
      { id: b.id },
      {
        onSuccess: () => toast.success("Booking declined — hold released"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not decline"),
      },
    );
  }

  const actionPending = acceptMutation.isPending || declineMutation.isPending;

  function markCompleted(b: BookingView) {
    updateStatus.mutate(
      { id: b.id, status: "completed" },
      {
        onSuccess: () => toast.success("Booking marked completed"),
        onError: (e) =>
          toast.error(
            isMissingStatusMigration(e)
              ? "Apply migration 0002 in Supabase to enable “completed”."
              : e instanceof Error
                ? e.message
                : "Could not update",
          ),
      },
    );
  }

  if (loadingProvider) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Not a provider yet — inline onboarding into the profile dialog.
  if (!provider) {
    return (
      <>
        <EmptyState
          icon={Sparkles}
          title="Start earning on YardLine"
          description="Set up a provider profile to list services, take bookings, and get paid by students on campus."
          action={
            <Button className="font-semibold" onClick={() => setProfileOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Become a provider
            </Button>
          }
        />
        <ProviderProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </>
    );
  }

  const serviceList = services ?? [];
  const paidServicesBlocked = !paymentsActive(connect) && serviceList.some((s) => (s.price_cents ?? 0) > 0);

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-heading text-xl font-bold">Your services</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit profile
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/provider/${userId}`}>
              <ExternalLink className="h-4 w-4" />
              View page
            </Link>
          </Button>
        </div>
      </div>

      {/* Availability */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="font-semibold">Accepting bookings</p>
          <p className="text-sm text-muted-foreground">
            {provider.is_available ? "Students can request your services." : "New requests are paused."}
          </p>
        </div>
        <Switch
          checked={provider.is_available ?? false}
          onCheckedChange={(v) => availability.mutate(v)}
          disabled={availability.isPending}
        />
      </div>

      {paidServicesBlocked ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Activate payments to accept paid bookings</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>You can receive requests, but you can’t accept paid ones until payments are active.</span>
            <Button size="sm" variant="outline" onClick={onActivatePayments} className="shrink-0">
              Go to Payments
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Wrench} label="Services" value={serviceList.length} />
        <StatCard icon={Inbox} label="Requests" value={requests.length} />
        <StatCard icon={CheckCircle2} label="Confirmed" value={confirmedCount} />
      </div>

      {/* Booking requests */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold">
          <Inbox className="h-5 w-5 text-primary" />
          Booking requests
        </h3>
        {loadingBookings ? (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No pending requests right now.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                role="provider"
                showPayment
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decline(b)}
                      disabled={actionPending}
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => accept(b)}
                      disabled={actionPending}
                      className="font-semibold"
                    >
                      {actionPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Accept
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming / confirmed */}
      {upcoming.length > 0 ? (
        <section>
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold">
            <CalendarClock className="h-5 w-5 text-primary" />
            Confirmed bookings
          </h3>
          <div className="space-y-4">
            {upcoming.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                role="provider"
                showPayment
                actions={
                  b.status === "confirmed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markCompleted(b)}
                      disabled={updateStatus.isPending}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark completed
                    </Button>
                  ) : null
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Services menu */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
            <Wrench className="h-5 w-5 text-primary" />
            Service menu
          </h3>
          <Button size="sm" onClick={openNew} className="font-semibold">
            <Plus className="h-4 w-4" />
            Add service
          </Button>
        </div>
        {loadingServices ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : serviceList.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No services yet"
            description="Add your first service so students can book you."
            action={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" />
                Add a service
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {serviceList.map((s) => (
              <ServiceManageRow key={s.service_id} service={s} onEdit={openEdit} />
            ))}
          </div>
        )}
      </section>

      <ServiceEditorDialog open={editorOpen} onOpenChange={setEditorOpen} service={editing} />
      <ProviderProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

function ProviderProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Provider profile</DialogTitle>
          <DialogDescription>
            Set up how students see your storefront, then add services and take bookings.
          </DialogDescription>
        </DialogHeader>
        <ProviderProfileForm onSaved={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
