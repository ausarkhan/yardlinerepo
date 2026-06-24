import { Link, NavLink } from "react-router-dom";
import { Plus, MessageSquare } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UserMenu } from "./UserMenu";
import { MobileMenu } from "./MobileMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useUnreadMessages } from "@/hooks/useMessaging";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { data: unreadMessages } = useUnreadMessages();
  const msgCount = unreadMessages ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {isActive ? (
                      <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Button asChild size="sm" className="hidden font-semibold sm:inline-flex">
            <Link to="/create-event">
              <Plus className="h-4 w-4" />
              Create
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="relative hidden md:inline-flex" aria-label="Messages">
            <Link to="/messages">
              <MessageSquare className="h-5 w-5" />
              {msgCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {msgCount > 9 ? "9+" : msgCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <div className="hidden md:block">
            <NotificationBell />
          </div>
          <ThemeToggle />
          <div className="hidden md:block">
            <UserMenu />
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
