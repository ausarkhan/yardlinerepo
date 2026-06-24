import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Logo } from "@/components/brand/Logo";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-field">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Logo withWordmark={false} size={48} className="animate-glow-pulse" />
        <p className="text-sm text-muted-foreground">Loading YardLine…</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") return <FullScreenLoader />;
  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

// For /login and /verify — bounce already-authenticated users to home.
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") return <FullScreenLoader />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}
