import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { useAuthInit } from "@/hooks/useAuthInit";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Home from "./pages/Home";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import CreateEvent from "./pages/CreateEvent";
import EventAttendees from "./pages/EventAttendees";
import EventCheckin from "./pages/EventCheckin";
import MyYardTix from "./pages/MyYardTix";
import CreatorDashboard from "./pages/CreatorDashboard";
import Services from "./pages/Services";
import ProviderDetail from "./pages/ProviderDetail";
import MyBookings from "./pages/MyBookings";
import Receipt from "./pages/Receipt";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
// Phase 5 — trust, safety, messaging, reviews, admin, compliance
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Report from "./pages/Report";
import Admin from "./pages/Admin";
import AdminReports from "./pages/AdminReports";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Waiver from "./pages/Waiver";
// Phase 6 — organizations and campus management
import Organizations from "./pages/Organizations";
import OrganizationDetail from "./pages/OrganizationDetail";
import NewOrganization from "./pages/NewOrganization";
import EditOrganization from "./pages/EditOrganization";
import OrgDashboard from "./pages/OrgDashboard";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
});

function AppRoutes() {
  useAuthInit();

  return (
    <Routes>
      {/* Auth (public only) */}
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/verify" element={<PublicOnlyRoute><Verify /></PublicOnlyRoute>} />

      {/* Legal — public, reachable without signing in */}
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/waiver" element={<Waiver />} />

      {/* Authenticated app */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/create-event" element={<CreateEvent />} />
        <Route path="/event/:id/edit" element={<CreateEvent />} />
        <Route path="/event/:id/attendees" element={<EventAttendees />} />
        <Route path="/event/:id/checkin" element={<EventCheckin />} />
        <Route path="/my-yardtix" element={<MyYardTix />} />
        <Route path="/creator-dashboard" element={<CreatorDashboard />} />
        <Route path="/services" element={<Services />} />
        <Route path="/provider/:id" element={<ProviderDetail />} />
        <Route path="/bookings" element={<MyBookings />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/receipt" element={<Receipt />} />

        {/* Phase 5 — messaging, reporting, admin */}
        <Route path="/messages" element={<Messages />} />
        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/report" element={<Report />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/reports" element={<AdminReports />} />

        {/* Phase 6 — organizations */}
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/organizations/new" element={<NewOrganization />} />
        <Route path="/organizations/:id" element={<OrganizationDetail />} />
        <Route path="/organizations/:id/edit" element={<EditOrganization />} />
        <Route path="/org-dashboard" element={<OrgDashboard />} />

        {/* Phase 3 unified the host + provider dashboards into /creator-dashboard.
            Keep the old paths working (mobile app / saved links) as redirects. */}
        <Route path="/host-dashboard" element={<Navigate to="/creator-dashboard?tab=events" replace />} />
        <Route
          path="/provider-dashboard"
          element={<Navigate to="/creator-dashboard?tab=services" replace />}
        />
        <Route
          path="/provider-setup"
          element={<Navigate to="/creator-dashboard?tab=services" replace />}
        />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
