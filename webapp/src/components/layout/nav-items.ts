import {
  Home,
  CalendarDays,
  Sparkles,
  User,
  Ticket,
  LayoutDashboard,
  CalendarCheck,
  MessageSquare,
  Users2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Primary navigation shown in the top bar (desktop).
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/services", label: "Services", icon: Sparkles },
  { to: "/organizations", label: "Organizations", icon: Users2 },
  { to: "/my-yardtix", label: "My YardTix", icon: Ticket },
];

// Account / creator entries shown in menus.
export const ACCOUNT_ITEMS: NavItem[] = [
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/my-bookings", label: "My bookings", icon: CalendarCheck },
  { to: "/org-dashboard", label: "Org dashboard", icon: Users2 },
  { to: "/creator-dashboard", label: "Creator dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "Profile", icon: User },
];
