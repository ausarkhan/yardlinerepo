import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

export function Hero() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const [q, setQ] = useState("");

  const firstName = profile?.name?.split(" ")[0];

  function search(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/events${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  }

  return (
    <section className="relative overflow-hidden border-b border-border/70 bg-secondary text-secondary-foreground">
      <div className="absolute inset-0 yardline-stripes opacity-50" />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
      <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-green/20 blur-3xl" />

      <div className="container relative py-16 md:py-24">
        <div className="max-w-2xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            {firstName ? `Welcome back, ${firstName}` : "Welcome to YardLine"}
          </span>
          <h1 className="mt-5 font-heading text-4xl font-extrabold leading-[1.05] md:text-6xl">
            Find your next
            <br />
            <span className="text-gradient-gold">moment on the yard.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-secondary-foreground/80 md:text-lg">
            Discover campus events and book trusted student providers — all in one place.
          </p>

          <form onSubmit={search} className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events, parties, providers…"
                className="h-14 rounded-full border-0 bg-background pl-12 text-base text-foreground shadow-lg"
              />
            </div>
            <Button type="submit" size="lg" className="h-14 rounded-full px-8 text-base font-semibold">
              Explore
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
