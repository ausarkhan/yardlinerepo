import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "./ReportDialog";
import { useAuthStore } from "@/store/auth";
import type { ReportTargetType } from "@/lib/types";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  iconOnly?: boolean;
  className?: string;
}

// Lightweight entry point that opens the ReportDialog. Hidden for signed-out
// users and when reporting yourself (a user target that equals the caller).
export function ReportButton({
  targetType,
  targetId,
  label = "Report",
  size = "sm",
  variant = "ghost",
  iconOnly = false,
  className,
}: ReportButtonProps) {
  const me = useAuthStore((s) => s.user?.id);
  const [open, setOpen] = useState(false);

  if (!me) return null;
  if (targetType === "user" && targetId === me) return null;

  return (
    <>
      <Button
        size={iconOnly ? "icon" : size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Report"
      >
        <Flag className="h-4 w-4" />
        {iconOnly ? null : label}
      </Button>
      <ReportDialog open={open} onOpenChange={setOpen} targetType={targetType} targetId={targetId} />
    </>
  );
}
