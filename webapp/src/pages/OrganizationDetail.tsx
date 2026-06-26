import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Users2, Mail, Globe, Instagram, GraduationCap, Settings2, CalendarDays, BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { SmartImage } from "@/components/common/SmartImage";
import { EventCard } from "@/components/events/EventCard";
import { JoinButton } from "@/components/organizations/JoinButton";
import { MemberList } from "@/components/organizations/MemberList";
import { AnnouncementList } from "@/components/organizations/AnnouncementList";
import { RoleBadge } from "@/components/organizations/RoleBadge";
import { MessageOrganizationDialog } from "@/components/organizations/MessageOrganizationDialog";
import { ReportButton } from "@/components/reports/ReportButton";
import { useOrganization, useMyOrgRole, useOrgEvents } from "@/hooks/useOrganizations";
import { orgCategoryLabel, isOfficer } from "@/lib/organizations";
import { avatarUrl, initials } from "@/lib/helpers";

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: org, isLoading } = useOrganization(id);
  const { data: membership } = useMyOrgRole(id);
  const { data: events } = useOrgEvents(id);

  if (isLoading) {
    return (
      <div className="container max-w-5xl py-8">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-10 w-1/2" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={Users2}
          title="Organization not found"
          description="It may have been archived or is unavailable."
          action={<Button onClick={() => navigate("/organizations")}>Browse organizations</Button>}
        />
      </div>
    );
  }

  const officer = isOfficer(membership?.role);
  const social = org.social_links ?? {};
  const upcoming = (events ?? []).filter((e) => !e.date || e.date >= new Date().toISOString().slice(0, 10));

  return (
    <div className="container max-w-5xl py-6 md:py-8">
      <Link
        to="/organizations"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All organizations
      </Link>

      {/* Cover */}
      <div className="relative h-40 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/20 to-secondary/20 md:h-52">
        {org.cover && avatarUrl(org.cover) ? (
          <SmartImage src={avatarUrl(org.cover)!} alt={org.name} className="h-full w-full object-cover" />
        ) : null}
      </div>

      {/* Identity */}
      <div className="relative -mt-12 px-2 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={avatarUrl(org.logo)} alt={org.name} />
            <AvatarFallback className="bg-secondary text-xl font-bold text-secondary-foreground">
              {initials(org.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-extrabold md:text-3xl">{org.name}</h1>
              <Badge variant="secondary" className="border-0">
                {orgCategoryLabel(org.category)}
              </Badge>
              {org.verification_level === "verified" ? (
                <Badge className="gap-1 border-0 bg-green/15 text-green">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {org.member_count ?? 0} member{(org.member_count ?? 0) === 1 ? "" : "s"}
              {org.department ? ` · ${org.department}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 pb-1">
            {membership ? <RoleBadge role={membership.role} /> : null}
            {officer ? (
              <Button size="sm" variant="outline" onClick={() => navigate("/org-dashboard")}>
                <Settings2 className="h-4 w-4" />
                Manage
              </Button>
            ) : null}
            <MessageOrganizationDialog org={org} />
            <JoinButton org={org} />
            <ReportButton targetType="user" targetId={org.created_by} iconOnly />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-8 px-2 md:px-6">
        <Tabs defaultValue="announcements">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="events">Events ({(events ?? []).length})</TabsTrigger>
            <TabsTrigger value="members">Members ({org.member_count ?? 0})</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="announcements">
            <AnnouncementList orgId={org.id} />
          </TabsContent>

          <TabsContent value="inbox">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-heading text-lg font-bold">Message the organization</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Questions about joining, sponsorships, collaborations, events, and campus partnerships go to the shared organization inbox.
              </p>
              <div className="mt-4">
                <MessageOrganizationDialog org={org} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            {org.description ? (
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{org.description}</p>
            ) : null}
            {org.mission ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-1.5 font-heading text-lg font-bold">Our mission</h3>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{org.mission}</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {org.contact_email ? <InfoRow icon={Mail} label="Contact" value={org.contact_email} /> : null}
              {org.advisor_name ? <InfoRow icon={GraduationCap} label="Advisor" value={org.advisor_name} /> : null}
              {social.website ? <InfoRow icon={Globe} label="Website" value={social.website} /> : null}
              {social.instagram ? <InfoRow icon={Instagram} label="Instagram" value={social.instagram} /> : null}
            </div>
          </TabsContent>

          <TabsContent value="events">
            {(events ?? []).length === 0 ? (
              <EmptyState icon={CalendarDays} title="No events yet" description="This organization hasn't posted events." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members">
            <MemberList orgId={org.id} />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
