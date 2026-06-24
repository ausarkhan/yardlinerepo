import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Sparkles, CreditCard } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreatorAnalytics } from "@/components/creator/CreatorAnalytics";
import { EventsTab } from "@/components/creator/EventsTab";
import { ServicesTab } from "@/components/creator/ServicesTab";
import { PaymentsTab } from "@/components/creator/PaymentsTab";

type TabKey = "events" | "services" | "payments";
const TABS: TabKey[] = ["events", "services", "payments"];

// The single hub for anyone making money on YardLine — event hosts, service
// providers, or both. Replaces the separate host/provider dashboards.
export default function CreatorDashboard() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = TABS.includes(raw as TabKey) ? (raw as TabKey) : "events";

  const setTab = useCallback(
    (next: string) => {
      const p = new URLSearchParams(params);
      p.set("tab", next);
      setParams(p, { replace: true });
    },
    [params, setParams],
  );

  const goToPayments = useCallback(() => setTab("payments"), [setTab]);

  return (
    <div className="container max-w-5xl py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <LayoutDashboard className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Creator dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Run your events, services, and payments — all in one place.
          </p>
        </div>
      </header>

      <div className="mb-8">
        <CreatorAnalytics />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="events" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <EventsTab onActivatePayments={goToPayments} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesTab onActivatePayments={goToPayments} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
