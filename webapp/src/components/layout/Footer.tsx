import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { NAV_ITEMS } from "./nav-items";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/70 bg-card/40">
      <div className="container py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs space-y-3">
            <Logo />
            <p className="text-sm text-muted-foreground">
              The home field for campus events and student-run services.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 sm:flex sm:gap-10">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Explore
              </p>
              {NAV_ITEMS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} YardLine. All rights reserved.</p>
          <p>Built for the culture.</p>
        </div>
      </div>
    </footer>
  );
}
