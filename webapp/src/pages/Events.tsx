import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarX2, ArrowDownUp } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";
import { EventCard } from "@/components/events/EventCard";
import { SearchBar } from "@/components/common/SearchBar";
import { CategoryChips } from "@/components/common/CategoryChips";
import { EmptyState } from "@/components/common/EmptyState";
import { CardGridSkeleton } from "@/components/common/CardSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPastDate } from "@/lib/helpers";

type SortKey = "soonest" | "latest";

export default function Events() {
  const { data: events, isLoading } = useEvents();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("soonest");

  const categories = useMemo(() => {
    const set = new Set<string>();
    (events ?? []).forEach((e) => e.category && set.add(e.category));
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let list = events ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q),
      );
    }
    if (category !== "all") list = list.filter((e) => e.category === category);

    return [...list].sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return sort === "soonest" ? ta - tb : tb - ta;
    });
  }, [events, search, category, sort]);

  const upcoming = filtered.filter((e) => !isPastDate(e.date));
  const past = filtered.filter((e) => isPastDate(e.date));
  const ordered = [...upcoming, ...past];

  return (
    <div className="container py-8 md:py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-heading text-3xl font-extrabold md:text-4xl">Events</h1>
        <p className="mt-2 text-muted-foreground">
          Everything happening around campus — parties, games, mixers and more.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search events, places…"
          className="lg:max-w-md"
        />
        <div className="flex items-center gap-3 lg:ml-auto">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-12 w-[170px] rounded-full">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soonest">Date: Soonest</SelectItem>
              <SelectItem value="latest">Date: Latest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-8">
        <CategoryChips categories={categories} active={category} onChange={setCategory} />
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : ordered.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No events found"
          description="Try a different search or category. New events drop all the time."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ordered.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
