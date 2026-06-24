import { useNavigate } from "react-router-dom";
import {
  LogOut,
  User as UserIcon,
  Sparkles,
  Ticket,
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth";
import { useIsAdmin } from "@/hooks/useAdmin";
import { signOut } from "@/lib/auth";
import { avatarUrl, initials } from "@/lib/helpers";
import { toast } from "sonner";

export function UserMenu() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const isAdmin = useIsAdmin();

  const name = profile?.name || user?.email?.split("@")[0] || "Member";
  const email = profile?.email || user?.email || "";

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-9 w-9 border-2 border-border">
            <AvatarImage src={avatarUrl(profile?.avatar)} alt={name} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/my-yardtix")}>
          <Ticket className="h-4 w-4" />
          My YardTix
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/bookings")}>
          <CalendarCheck className="h-4 w-4" />
          My bookings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/messages")}>
          <MessageSquare className="h-4 w-4" />
          Messages
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/creator-dashboard")}>
          <LayoutDashboard className="h-4 w-4" />
          Creator dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/create-event")}>
          <CalendarPlus className="h-4 w-4" />
          Create event
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <UserIcon className="h-4 w-4" />
          My profile
        </DropdownMenuItem>
        {profile?.is_provider ? null : (
          <DropdownMenuItem onClick={() => navigate("/creator-dashboard?tab=services")}>
            <Sparkles className="h-4 w-4" />
            Become a provider
          </DropdownMenuItem>
        )}
        {isAdmin ? (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <ShieldCheck className="h-4 w-4" />
            Admin dashboard
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
