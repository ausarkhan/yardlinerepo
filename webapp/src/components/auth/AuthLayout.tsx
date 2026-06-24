import { Logo } from "@/components/brand/Logo";
import { CalendarDays, Scissors, Ticket } from "lucide-react";

// Two-pane auth shell: collegiate brand panel + form.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-secondary text-secondary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 yardline-stripes opacity-60" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-green/20 blur-3xl" />

        <div className="relative">
          <Logo size={40} className="[&_span]:text-secondary-foreground" />
        </div>

        <div className="relative space-y-6">
          <h1 className="font-heading text-4xl font-extrabold leading-tight xl:text-5xl">
            Your campus,
            <br />
            <span className="text-gradient-gold">all in one place.</span>
          </h1>
          <p className="max-w-md text-secondary-foreground/80">
            Discover events, book trusted student providers, and never miss a
            moment on the yard.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              { icon: CalendarDays, label: "Find events happening around campus" },
              { icon: Ticket, label: "RSVP and grab tickets in seconds" },
              { icon: Scissors, label: "Book barbers, photographers & more" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-gold">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-secondary-foreground/50">
          © {new Date().getFullYear()} YardLine. Built for the culture.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col bg-background bg-field lg:min-h-0">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}
