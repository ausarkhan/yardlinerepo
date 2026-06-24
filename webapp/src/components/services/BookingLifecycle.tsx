import { Check, Circle, X, RotateCcw } from "lucide-react";
import {
  LIFECYCLE_STEPS,
  lifecycleProgress,
  type LifecycleOutcome,
} from "@/lib/services";
import { cn } from "@/lib/utils";

interface BookingLifecycleProps {
  status: string | null | undefined;
  paymentStatus: string | null | undefined;
}

const OUTCOME_LABEL: Record<Exclude<LifecycleOutcome, "active">, string> = {
  declined: "Declined by provider",
  cancelled: "Cancelled by you",
  refunded: "Refunded",
};

const OUTCOME_DETAIL: Record<Exclude<LifecycleOutcome, "active">, string> = {
  declined: "The provider declined — the hold on your card was released.",
  cancelled: "You cancelled the request before it was accepted. No charge was made.",
  refunded: "The charge has been reversed back to your card.",
};

type NodeState = "done" | "current" | "upcoming" | "failed";

// Vertical stepper of the buyer's authorize-not-charge journey. The happy path
// runs Requested → Provider review → Confirmed & paid → Completed; a negative
// outcome (declined / cancelled / refunded) replaces the next pending step.
export function BookingLifecycle({ status, paymentStatus }: BookingLifecycleProps) {
  const { reachedIndex, outcome } = lifecycleProgress(status, paymentStatus);
  const failedAt = outcome === "active" ? -1 : reachedIndex + 1;

  return (
    <ol className="space-y-0">
      {LIFECYCLE_STEPS.map((step, i) => {
        const isFailedNode = i === failedAt;
        const state: NodeState = isFailedNode
          ? "failed"
          : i <= reachedIndex
            ? "done"
            : i === reachedIndex + 1 && outcome === "active"
              ? "current"
              : "upcoming";

        // Past the terminal node nothing else is reachable — dim it.
        const afterTerminal = failedAt !== -1 && i > failedAt;
        const isLast = i === LIFECYCLE_STEPS.length - 1;

        const label = isFailedNode
          ? OUTCOME_LABEL[outcome as Exclude<LifecycleOutcome, "active">]
          : step.label;
        const description = isFailedNode
          ? OUTCOME_DETAIL[outcome as Exclude<LifecycleOutcome, "active">]
          : step.description;

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  state === "done" && "border-green bg-green text-white",
                  state === "current" && "border-primary bg-primary/10 text-primary",
                  state === "failed" &&
                    outcome === "refunded" &&
                    "border-secondary bg-secondary/10 text-secondary",
                  state === "failed" &&
                    outcome !== "refunded" &&
                    "border-destructive bg-destructive/10 text-destructive",
                  state === "upcoming" && "border-border bg-muted text-muted-foreground",
                )}
              >
                {state === "done" ? (
                  <Check className="h-4 w-4" />
                ) : state === "failed" && outcome === "refunded" ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : state === "failed" ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Circle className={cn("h-2.5 w-2.5", state === "current" && "fill-primary")} />
                )}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    "my-1 w-0.5 flex-1 rounded-full",
                    i < reachedIndex ? "bg-green" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <div className={cn("pb-5", afterTerminal && "opacity-40")}>
              <p
                className={cn(
                  "text-sm font-semibold leading-7",
                  state === "current" && "text-primary",
                  state === "failed" && outcome !== "refunded" && "text-destructive",
                )}
              >
                {label}
              </p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
