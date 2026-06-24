import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingBadgeProps {
  average: number; // 0–10
  count?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Compact numeric rating on the 1–10 scale, e.g. ★ 8.5 /10 (12).
export function RatingBadge({ average, count, size = "md", className }: RatingBadgeProps) {
  const has = average > 0;
  const text = size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm";
  const icon = size === "lg" ? 18 : size === "sm" ? 13 : 15;

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium", text, className)}>
      <Star
        style={{ width: icon, height: icon }}
        className={cn(has ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40")}
      />
      {has ? (
        <>
          <span className="font-bold">{average.toFixed(1)}</span>
          <span className="text-muted-foreground">/10</span>
        </>
      ) : (
        <span className="text-muted-foreground">New</span>
      )}
      {count != null && count > 0 ? (
        <span className="text-muted-foreground">
          ({count} review{count === 1 ? "" : "s"})
        </span>
      ) : null}
    </span>
  );
}
