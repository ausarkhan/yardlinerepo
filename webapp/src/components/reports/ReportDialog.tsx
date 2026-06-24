import { useState } from "react";
import { Loader2, Flag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSubmitReport } from "@/hooks/useReports";
import { REPORT_CATEGORIES, REPORT_TARGET_LABELS } from "@/lib/reports";
import type { ReportCategory, ReportTargetType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
  const submit = useSubmitReport();
  const [category, setCategory] = useState<ReportCategory>("spam");
  const [details, setDetails] = useState("");

  const onSubmit = () => {
    submit.mutate(
      { targetType, targetId, category, details },
      {
        onSuccess: () => {
          toast.success("Report submitted. Our moderators will review it.");
          setDetails("");
          setCategory("spam");
          onOpenChange(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't submit report."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Report {REPORT_TARGET_LABELS[targetType].toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            Tell us what's wrong. Reports are confidential and reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <RadioGroup value={category} onValueChange={(v) => setCategory(v as ReportCategory)} className="gap-2">
            {REPORT_CATEGORIES.map((c) => (
              <Label
                key={c.value}
                htmlFor={`cat-${c.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  category === c.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <RadioGroupItem value={c.value} id={`cat-${c.value}`} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>

          <div className="space-y-1.5">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add anything that helps us understand the issue…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onSubmit} disabled={submit.isPending}>
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
