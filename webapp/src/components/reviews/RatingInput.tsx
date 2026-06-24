import { REVIEW_MAX } from "@/lib/reviews";
import { cn } from "@/lib/utils";

interface RatingInputProps {
  value: number; // 1..10, 0 = none selected
  onChange: (v: number) => void;
}

const LABELS: Record<number, string> = {
  0: "Tap a number to rate",
  1: "Terrible",
  2: "Very poor",
  3: "Poor",
  4: "Below average",
  5: "Okay",
  6: "Fair",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Outstanding",
};

// 1–10 rating selector rendered as a wrapping row of numbered pills.
export function RatingInput({ value, onChange }: RatingInputProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: REVIEW_MAX }, (_, i) => i + 1).map((n) => {
          const active = n <= value;
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`Rate ${n} out of 10`}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
                selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {value > 0 ? (
          <>
            <span className="font-semibold text-foreground">{value}/10</span> — {LABELS[value]}
          </>
        ) : (
          LABELS[0]
        )}
      </p>
    </div>
  );
}
