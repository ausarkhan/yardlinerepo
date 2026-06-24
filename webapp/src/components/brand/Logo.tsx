import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
  size?: number;
}

// YardLine mark: a gold pennant with a football yard-line stripe.
export function Logo({ className, withWordmark = true, size = 32 }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="36" height="36" rx="11" fill="hsl(var(--maroon))" />
        <path d="M11 10h14l-3.5 5L25 20H11V10z" fill="hsl(var(--gold))" />
        <rect x="11" y="10" width="2.4" height="20" rx="1.2" fill="hsl(var(--gold))" />
        <path
          d="M9 32h22"
          stroke="hsl(var(--green))"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      {withWordmark ? (
        <span className="font-heading text-xl font-extrabold tracking-tight leading-none">
          Yard<span className="text-gradient-gold">Line</span>
        </span>
      ) : null}
    </span>
  );
}
