import { CalendarDays, Sparkles } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";
import { useProviders } from "@/hooks/useProviders";
import { Hero } from "@/components/home/Hero";
import { SectionHeader } from "@/components/home/SectionHeader";
import { CtaCards } from "@/components/home/CtaCards";
import { EventCard } from "@/components/events/EventCard";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/CardSkeleton";
import { isPastDate } from "@/lib/helpers";

export default function Home() {
  const { data: events, isLoading: eventsLoading } = useEvents();
  const { data: providers, isLoading: providersLoading } = useProviders();

  const featuredEvents = (events ?? [])
    .filter((e) => !isPastDate(e.date))
    .slice(0, 4);
  const fallbackEvents = (events ?? []).slice(0, 4);
  const eventsToShow = featuredEvents.length > 0 ? featuredEvents : fallbackEvents;
  const featuredProviders = (providers ?? []).slice(0, 4);

  return (
    <div>
      <Hero />

      <div className="container space-y-16 py-12 md:py-16">
        {/* Featured events */}
        <section>
          <SectionHeader
            title="Featured events"
            subtitle="Don’t miss what’s coming up"
            href="/events"
          />
          {eventsLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : eventsToShow.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No events yet"
              description="Check back soon — new events are added all the time."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {eventsToShow.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <CtaCards />

        {/* Featured providers */}
        <section>
          <SectionHeader
            title="Featured providers"
            subtitle="Trusted services from fellow students"
            href="/services"
          />
          {providersLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : featuredProviders.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No providers yet"
              description="Student providers will show up here as they join."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProviders.map((provider, i) => (
                <ProviderCard key={provider.id} provider={provider} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
