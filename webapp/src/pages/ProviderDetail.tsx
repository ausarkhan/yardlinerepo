import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  UserX,
  CalendarRange,
  Settings2,
  CalendarPlus,
} from "lucide-react";
import { useProvider, useProviderServices } from "@/hooks/useProviders";
import { useReviews } from "@/hooks/useReviews";
import { useAuthStore } from "@/store/auth";
import { ServiceList } from "@/components/providers/ServiceList";
import { BookServiceDialog } from "@/components/services/BookServiceDialog";
import type { Service } from "@/lib/types";
import { ReviewList } from "@/components/providers/ReviewList";
import { LeaveReviewButton } from "@/components/reviews/LeaveReviewButton";
import { ReputationBadges, providerStats } from "@/components/reviews/ReputationBadges";
import { StartConversationButton } from "@/components/messaging/StartConversationButton";
import { ReportButton } from "@/components/reports/ReportButton";
import { useProviderReputation } from "@/hooks/useReputation";
import { useWaiverGate } from "@/hooks/useWaiverGate";
import { SmartImage } from "@/components/common/SmartImage";
import { StarRating } from "@/components/common/StarRating";
import { EmptyState } from "@/components/common/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  providerImage,
  providerGallery,
  providerName,
  avatarUrl,
  initials,
  titleCase,
} from "@/lib/helpers";

export default function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: provider, isLoading } = useProvider(id);
  const { data: services } = useProviderServices(provider?.user_id);
  const { data: reviews } = useReviews(provider?.id);
  const { data: reputation } = useProviderReputation(provider?.id, provider?.user_id);
  const myUserId = useAuthStore((s) => s.user?.id);

  const [bookOpen, setBookOpen] = useState(false);
  const [bookService, setBookService] = useState<Service | undefined>(undefined);
  const { run: gateBooking, gate: bookingGate } = useWaiverGate("book this service");

  // Booking a service is gated behind legal acceptance (Terms, Privacy, Waiver).
  function openBooking(service?: Service) {
    gateBooking(() => {
      setBookService(service);
      setBookOpen(true);
    });
  }

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-8">
        <Skeleton className="mb-6 h-6 w-24" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-10 w-1/2" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={UserX}
          title="Provider not found"
          description="This provider may have been removed or is unavailable."
          action={<Button onClick={() => navigate("/services")}>Browse providers</Button>}
        />
      </div>
    );
  }

  const name = providerName(provider);
  const gallery = providerGallery(provider);
  const serviceList = services ?? [];
  const isOwner = !!myUserId && provider.user_id === myUserId;
  const canBook = !isOwner && provider.is_available && serviceList.length > 0;
  const reviewList = reviews ?? [];
  const avg =
    reviewList.length > 0
      ? reviewList.reduce((s, r) => s + (r.score ?? 0), 0) / reviewList.length
      : 0;

  return (
    <div className="container max-w-5xl py-6 md:py-8">
      <Link
        to="/services"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All providers
      </Link>

      {isOwner ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Settings2 className="h-4 w-4 text-primary" />
            <span className="font-medium">This is your provider page</span>
          </div>
          <Button size="sm" onClick={() => navigate("/creator-dashboard?tab=services")}>
            Manage services & bookings
          </Button>
        </div>
      ) : null}

      {/* Cover */}
      <div className="relative h-44 overflow-hidden rounded-2xl border border-border bg-muted md:h-60">
        <SmartImage src={providerImage(provider)} alt={name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Identity */}
      <div className="relative -mt-12 px-2 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={avatarUrl(provider.user_data?.avatar)} alt={name} />
            <AvatarFallback className="bg-secondary text-xl font-bold text-secondary-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-extrabold md:text-3xl">{name}</h1>
              {provider.category ? (
                <Badge variant="secondary" className="border-0">
                  {titleCase(provider.category)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <StarRating value={avg} count={reviewList.length} />
              {provider.response_time ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Responds {provider.response_time}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 pb-1 sm:items-end">
            <Badge
              className={
                provider.is_available
                  ? "border-0 bg-green text-white"
                  : "border-0 bg-muted text-muted-foreground"
              }
            >
              {provider.is_available ? (
                <>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Available now
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Unavailable
                </>
              )}
            </Badge>
            {canBook ? (
              <Button size="sm" className="font-semibold" onClick={() => openBooking()}>
                <CalendarPlus className="h-4 w-4" />
                Book now
              </Button>
            ) : null}
            {!isOwner ? (
              <div className="flex items-center gap-2">
                <StartConversationButton
                  otherUserId={provider.user_id}
                  context="provider"
                  contextId={provider.id}
                />
                <ReportButton targetType="provider" targetId={provider.id} iconOnly />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Trust indicators */}
      {reputation ? (
        <div className="mt-6 px-2 md:px-6">
          <ReputationBadges stats={providerStats(reputation)} />
        </div>
      ) : null}

      {/* Body */}
      <div className="mt-8 px-2 md:px-6">
        {provider.description ? (
          <p className="mb-8 max-w-2xl whitespace-pre-line leading-relaxed text-muted-foreground">
            {provider.description}
          </p>
        ) : null}

        {gallery.length > 1 ? (
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.slice(0, 6).map((src, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                <SmartImage src={src} alt={`${name} work ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : null}

        <Tabs defaultValue="services" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviewList.length})</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <ServiceList
              services={serviceList}
              onBook={canBook ? openBooking : undefined}
              emptyDescription={
                isOwner
                  ? "You haven’t added any services yet. Open your dashboard to build your menu."
                  : undefined
              }
            />
          </TabsContent>

          <TabsContent value="reviews">
            {!isOwner ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">
                  Worked with {name}? Share your experience to help other students.
                </p>
                <LeaveReviewButton
                  targetType="provider"
                  targetId={provider.id}
                  targetName={name}
                  targetAvatar={provider.user_data?.avatar}
                  providerUserId={provider.user_id}
                />
              </div>
            ) : null}
            <ReviewList reviews={reviewList} />
          </TabsContent>

          <TabsContent value="availability">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <CalendarRange className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">
                    {provider.is_available ? "Currently accepting bookings" : "Not accepting bookings"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {provider.response_time
                      ? `Typically responds ${provider.response_time}.`
                      : "Reach out to check open slots."}
                  </p>
                </div>
              </div>
              {canBook ? (
                <Button className="mt-5 w-full sm:w-auto" onClick={() => openBooking()}>
                  <CalendarPlus className="h-4 w-4" />
                  Request a booking
                </Button>
              ) : (
                <Button disabled className="mt-5 w-full sm:w-auto">
                  {isOwner
                    ? "This is your page"
                    : provider.is_available
                      ? "No services to book yet"
                      : "Not accepting bookings"}
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {!isOwner ? (
        <BookServiceDialog
          provider={provider}
          services={serviceList}
          initialServiceId={bookService?.service_id}
          open={bookOpen}
          onOpenChange={setBookOpen}
        />
      ) : null}
      {bookingGate}
    </div>
  );
}
