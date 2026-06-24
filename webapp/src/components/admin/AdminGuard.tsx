import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuthStore } from "@/store/auth";
import { useIsAdmin } from "@/hooks/useAdmin";

// Gates admin routes. Waits for the profile to load, then blocks non-admins.
export function AdminGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const admin = useIsAdmin();

  // Auth still resolving, or authenticated but profile not yet hydrated.
  if (status === "loading" || (status === "authenticated" && !profile)) {
    return (
      <div className="container flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={ShieldX}
          title="Admins only"
          description="You don't have access to the moderation dashboard."
          action={
            <Button asChild>
              <Link to="/">Back to home</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
