import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchX, Sparkles } from "lucide-react";
import { useProviders } from "@/hooks/useProviders";
import { useAuthStore } from "@/store/auth";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { SearchBar } from "@/components/common/SearchBar";
import { CategoryChips } from "@/components/common/CategoryChips";
import { EmptyState } from "@/components/common/EmptyState";
import { CardGridSkeleton } from "@/components/common/CardSkeleton";
import { Button } from "@/components/ui/button";
import { providerName } from "@/lib/helpers";

export default function Services() {
  const { data: providers, isLoading } = useProviders();
  const isProvider = useAuthStore((s) => s.profile?.is_provider);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    (providers ?? []).forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [providers]);

  const filtered = useMemo(() => {
    let list = providers ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          providerName(p).toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }
    if (category !== "all") list = list.filter((p) => p.category === category);
    return list;
  }, [providers, search, category]);

  return (
    <div className="container py-8 md:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-heading text-3xl font-extrabold md:text-4xl">Services</h1>
          <p className="mt-2 text-muted-foreground">
            Book trusted student providers — barbers, photographers, stylists and more.
          </p>
        </div>
        <Button asChild variant={isProvider ? "outline" : "default"} className="shrink-0 font-semibold">
          <Link to="/creator-dashboard?tab=services">
            <Sparkles className="h-4 w-4" />
            {isProvider ? "Manage services" : "Become a provider"}
          </Link>
        </Button>
      </header>

      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search providers, services…"
          className="lg:max-w-md"
        />
      </div>

      <div className="mb-8">
        <CategoryChips categories={categories} active={category} onChange={setCategory} />
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No providers found"
          description="Try a different search or category."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((provider, i) => (
            <ProviderCard key={provider.id} provider={provider} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
