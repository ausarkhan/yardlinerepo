import { Badge } from "@/components/ui/badge";
import { ORG_ROLE_LABELS } from "@/lib/organizations";
import type { OrgRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  president: "border-primary/30 bg-primary/10 text-primary",
  admin: "border-primary/30 bg-primary/10 text-primary",
  officer: "border-secondary/40 bg-secondary/15 text-secondary-foreground",
  treasurer: "border-amber-400/30 bg-amber-400/10 text-amber-600",
  advisor: "border-green/30 bg-green/10 text-green",
  member: "border-border bg-muted text-muted-foreground",
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border", STYLES[role] ?? STYLES.member, className)}>
      {ORG_ROLE_LABELS[role as OrgRole] ?? role}
    </Badge>
  );
}
