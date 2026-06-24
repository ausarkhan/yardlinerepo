import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Tag,
  Users,
  CalendarX2,
  ChevronRight,
  Settings2,
  ReceiptText,
  ScanLine,
} from "lucide-react";
import { useEvent } from "@/hooks/useEvents";
import { useReviews } from "@/hooks/useReviews";
import { useReviewSummary } from "@/hooks/useReviewSystem";
import { RsvpCard } from "@/components/events/RsvpCard";
import { TicketCard } from "@/components/events/TicketCard";
import { EventActions } from "@/components/events/EventActions";
import { ReviewList } from "@/components/providers/ReviewList";
import { RatingBadge } from "@/components/reviews/RatingBadge";
import { LeaveReviewButton } from "@/components/reviews/LeaveReviewButton";
import { StartConversationButton } from "@/components/messaging/StartConversationButton";
import { ReportButton } from "@/components/reports/ReportButton";
import { SmartImage } from "@/components/common/SmartImage";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth";
import { parseRefundPolicy } from "@/lib/events";
import { REFUND_POLICIES, eventStatusLabel } from "@/lib/yardtix";
import {
  eventImage,
  formatEventDate,
  formatEventTime,
  hostName,
  avatarUrl,
  initials,
  titleCase,
} from "@/lib/helpers";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: event, isLoading } = useEvent(id);
  const { data: eventReviews } = useReviews(id);
  const { data: reviewSummary } = useReviewSummary(id);

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-8">
        <Skeleton className="mb-6 h-6 w-24" />
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={CalendarX2}
          title="Event not found"
          description="This event may have been removed or is no longer available."
          action={
            <Button onClick={() => navigate("/events")}>Browse events</Button>
          }
        />
      </div>
    );
  }

  const time = formatEventTime(event.time);
  const endTime = formatEventTime(event.end_time);
  const timeValue = time
    ? endTime
      ? `${time} – ${endTime}`
      : time
    : "Time TBA";

  const isHost = !!userId && event.host_id === userId;
  const refund = parseRefundPolicy(event);
  const refundMeta = REFUND_POLICIES.find((p) => p.value === refund.type);
  const hostIsProvider = !!event.host_data?.isProvider && !!event.host_id;

  return (
    <div className="container max-w-5xl py-6 md:py-8">
      <Link
        to="/events"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All events
      </Link>

      {isHost ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Settings2 className="h-4 w-4 text-primary" />
            <span className="font-medium">You host this event</span>
            <Badge variant="outline" className="ml-1">{eventStatusLabel(event.status)}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`/event/${event.id}/edit`)}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/event/${event.id}/attendees`)}>
              Attendees
            </Button>
            <Button size="sm" onClick={() => navigate(`/event/${event.id}/checkin`)}>
              <ScanLine className="h-4 w-4" />
              Check-in
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative aspect-[21/9] overflow-hidden rounded-2xl border border-border bg-muted">
        <SmartImage
          src={eventImage(event)}
          alt={event.title ?? "Event"}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/70 to-transparent p-4">
          {event.category ? (
            <Badge className="border-0 bg-background/90 text-foreground backdrop-blur">
              {titleCase(event.category)}
            </Badge>
          ) : null}
          <Badge
            className={
              event.is_free
                ? "border-0 bg-green text-white"
                : "border-0 bg-primary text-primary-foreground"
            }
          >
            {event.is_free ? "Free" : "Ticketed"}
          </Badge>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="font-heading text-3xl font-extrabold md:text-4xl">
              {event.title ?? "Untitled event"}
            </h1>
            <EventActions event={event} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <DetailRow icon={CalendarDays} label="Date" value={formatEventDate(event.date, { withYear: true })} />
            <DetailRow icon={Clock} label="Time" value={timeValue} />
            <DetailRow icon={MapPin} label="Location" value={event.location || "TBA"} />
            <DetailRow icon={Tag} label="Category" value={titleCase(event.category) || "General"} />
          </div>

          {event.description ? (
            <div>
              <h2 className="mb-2 font-heading text-xl font-bold">About this event</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            </div>
          ) : null}

          {/* Host */}
          <div>
            <h2 className="mb-3 font-heading text-xl font-bold">Hosted by</h2>
            {hostIsProvider ? (
              <Link
                to={`/provider/${event.host_id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  <AvatarImage src={avatarUrl(event.host_data?.avatar)} alt={hostName(event)} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                    {initials(hostName(event))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{hostName(event)}</p>
                  {event.host_data?.handle ? (
                    <p className="text-sm text-muted-foreground">{event.host_data.handle}</p>
                  ) : null}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  <AvatarImage src={avatarUrl(event.host_data?.avatar)} alt={hostName(event)} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                    {initials(hostName(event))}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{hostName(event)}</p>
                  {event.host_data?.handle ? (
                    <p className="text-sm text-muted-foreground">{event.host_data.handle}</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Contact + report host (not for your own event) */}
          {!isHost && event.host_id ? (
            <div className="flex flex-wrap gap-2">
              <StartConversationButton
                otherUserId={event.host_id}
                context="event"
                contextId={event.id}
                label="Message host"
              />
              <ReportButton targetType="event" targetId={event.id} label="Report event" />
            </div>
          ) : null}

          {/* Reviews */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
                Reviews
                {reviewSummary ? (
                  <RatingBadge average={reviewSummary.average} count={reviewSummary.count} size="sm" />
                ) : null}
              </h2>
              <LeaveReviewButton
                targetType="event"
                targetId={event.id}
                targetName={event.title}
                eventId={event.id}
              />
            </div>
            <ReviewList reviews={eventReviews ?? []} />
          </div>

          {/* Refund policy */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold">
              <ReceiptText className="h-5 w-5 text-primary" />
              Refund policy
            </h2>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="font-medium">{refundMeta?.label ?? "No refunds"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {refund.type === "custom" && refund.note ? refund.note : refundMeta?.desc}
              </p>
            </div>
          </div>

          {/* Capacity */}
          {event.max_tickets != null ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Capacity: {event.max_tickets} {event.is_free ? "RSVP spots" : "tickets"}
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            {event.is_free ? <RsvpCard event={event} /> : <TicketCard event={event} />}
          </div>
        </div>
      </div>
    </div>
  );
}
