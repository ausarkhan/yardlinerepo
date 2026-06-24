import { useRef, useState } from "react";
import { useWaiver } from "./useWaiver";
import { LegalAcceptanceDialog } from "@/components/legal/LegalAcceptanceDialog";

// Gate a paid/provider action behind legal acceptance with minimal wiring:
//
//   const { run, gate } = useWaiverGate("book this service");
//   <Button onClick={() => run(doBooking)}>Book</Button>
//   {gate}
//
// If the user has already accepted the current versions, the action runs
// immediately; otherwise the acceptance dialog opens and runs it on accept.
export function useWaiverGate(actionLabel: string) {
  const { accepted } = useWaiver();
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const run = (action: () => void) => {
    if (accepted) {
      action();
      return;
    }
    pending.current = action;
    setOpen(true);
  };

  const onAccepted = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const gate = (
    <LegalAcceptanceDialog
      open={open}
      onOpenChange={setOpen}
      actionLabel={actionLabel}
      onAccepted={onAccepted}
    />
  );

  return { run, gate, accepted };
}
