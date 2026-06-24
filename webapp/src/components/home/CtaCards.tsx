import { Link } from "react-router-dom";
import { CalendarDays, Sparkles, ArrowUpRight } from "lucide-react";

const CARDS = [
  {
    to: "/events",
    title: "Browse all events",
    desc: "Parties, games, mixers and everything in between.",
    icon: CalendarDays,
    className: "bg-secondary text-secondary-foreground",
    accent: "bg-gold/20 text-gold",
  },
  {
    to: "/services",
    title: "Book a provider",
    desc: "Barbers, photographers, stylists — vetted by your peers.",
    icon: Sparkles,
    className: "bg-accent text-accent-foreground",
    accent: "bg-white/20 text-white",
  },
];

export function CtaCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {CARDS.map(({ to, title, desc, icon: Icon, className, accent }) => (
        <Link
          key={to}
          to={to}
          className={`group relative overflow-hidden rounded-2xl p-7 transition-transform hover:-translate-y-1 ${className}`}
        >
          <div className="yardline-stripes absolute inset-0 opacity-30" />
          <div className="relative flex items-start justify-between">
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>
              <Icon className="h-6 w-6" />
            </span>
            <ArrowUpRight className="h-5 w-5 opacity-60 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </div>
          <h3 className="relative mt-6 font-heading text-xl font-bold">{title}</h3>
          <p className="relative mt-1.5 text-sm opacity-80">{desc}</p>
        </Link>
      ))}
    </div>
  );
}
