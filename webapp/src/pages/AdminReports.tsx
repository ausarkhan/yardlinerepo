import { Link } from "react-router-dom";
import { Flag, ArrowLeft } from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminReportsQueue } from "@/components/admin/AdminReportsQueue";

// Dedicated moderation queue at /admin/reports (also embedded in the Admin tabs).
export default function AdminReports() {
  return (
    <AdminGuard>
      <div className="container max-w-4xl py-8 md:py-12">
        <Link
          to="/admin"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin dashboard
        </Link>
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <Flag className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Moderation queue</h1>
            <p className="text-sm text-muted-foreground">Review and resolve reported content.</p>
          </div>
        </header>

        <AdminReportsQueue />
      </div>
    </AdminGuard>
  );
}
