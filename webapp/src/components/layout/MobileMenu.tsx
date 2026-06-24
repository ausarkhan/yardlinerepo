import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CalendarPlus } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NAV_ITEMS, ACCOUNT_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useAdmin";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0">
        <div className="flex h-full flex-col">
          <div className="border-b p-6">
            <Link to="/" onClick={() => setOpen(false)}>
              <Logo />
            </Link>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            <Link
              to="/create-event"
              onClick={() => setOpen(false)}
              className="mb-2 flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground"
            >
              <CalendarPlus className="h-5 w-5" />
              Create event
            </Link>
            {[...NAV_ITEMS, ...ACCOUNT_ITEMS].map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
            {isAdmin ? (
              <NavLink
                to="/admin"
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <ShieldCheck className="h-5 w-5" />
                Admin
              </NavLink>
            ) : null}
          </nav>
          <div className="border-t p-4">
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
              Log out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
