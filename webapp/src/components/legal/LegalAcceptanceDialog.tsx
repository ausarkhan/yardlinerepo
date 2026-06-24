import { Link } from "react-router-dom";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWaiver } from "@/hooks/useWaiver";
import { LEGAL_LABELS, REQUIRED_DOCUMENTS } from "@/lib/waivers";
import { LEGAL_CONTENT } from "@/lib/legalContent";
import { toast } from "sonner";

interface LegalAcceptanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // What the user is about to do, e.g. "book this service".
  actionLabel: string;
  onAccepted: () => void;
}

// Blocks a gated action until the user accepts Terms, Privacy, and the Waiver at
// their current versions. Records acceptance, then runs onAccepted().
export function LegalAcceptanceDialog({
  open,
  onOpenChange,
  actionLabel,
  onAccepted,
}: LegalAcceptanceDialogProps) {
  const { outstanding, accept } = useWaiver();
  const docs = outstanding.length > 0 ? outstanding : REQUIRED_DOCUMENTS;

  const onAccept = () => {
    accept.mutate(docs, {
      onSuccess: () => {
        onOpenChange(false);
        onAccepted();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't record acceptance."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Before you {actionLabel}
          </DialogTitle>
          <DialogDescription>
            YardLine is a marketplace. Providers and hosts operate independently, and participation is
            at your own risk. Please review and accept to continue.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-1">
          {REQUIRED_DOCUMENTS.map((doc) => (
            <li
              key={doc}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
            >
              <span className="text-sm font-medium">{LEGAL_LABELS[doc]}</span>
              <Link
                to={`/${doc}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Read <ExternalLink className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          {LEGAL_CONTENT.waiver.sections[2].body}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAccept} disabled={accept.isPending}>
            {accept.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Accept &amp; continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
