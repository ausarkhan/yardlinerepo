import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { AdminEventsTable } from "@/components/admin/AdminEventsTable";
import { AdminProvidersTable } from "@/components/admin/AdminProvidersTable";
import { AdminReportsQueue } from "@/components/admin/AdminReportsQueue";
import { ModerationHistory } from "@/components/admin/ModerationHistory";

const TABS = ["overview", "users", "events", "providers", "reports"] as const;
type AdminTab = (typeof TABS)[number];

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: AdminTab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as AdminTab) : "overview";

  return (
    <AdminGuard>
      <div className="container max-w-6xl py-8 md:py-12">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Admin dashboard</h1>
            <p className="text-sm text-muted-foreground">Platform health, moderation, and trust & safety.</p>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <AdminMetrics />
            <div>
              <h2 className="mb-3 font-heading text-lg font-bold">Recent moderation</h2>
              <ModerationHistory />
            </div>
          </TabsContent>

          <TabsContent value="users">
            <AdminUsersTable />
          </TabsContent>
          <TabsContent value="events">
            <AdminEventsTable />
          </TabsContent>
          <TabsContent value="providers">
            <AdminProvidersTable />
          </TabsContent>
          <TabsContent value="reports">
            <AdminReportsQueue />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
