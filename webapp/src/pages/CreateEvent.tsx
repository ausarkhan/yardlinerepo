import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Send, CalendarPlus, Ticket, PartyPopper, UserRound, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoverPicker } from "@/components/create/CoverPicker";
import { TierEditor } from "@/components/create/TierEditor";
import { useAuthStore } from "@/store/auth";
import { useHostEvent } from "@/hooks/useHostEvents";
import { useMyMemberships } from "@/hooks/useOrganizations";
import { isOfficer } from "@/lib/organizations";
import { useWaiverGate } from "@/hooks/useWaiverGate";
import { createEvent, updateEvent, eventTiers, parseRefundPolicy } from "@/lib/events";
import type { EventDraftInput } from "@/lib/events";
import { REFUND_POLICIES, type Tier, type EventStatus } from "@/lib/yardtix";
import { EVENT_CATEGORIES, titleCase, COVER_PRESETS } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function emptyTier(): Tier {
  return { id: `tier-${Date.now()}`, name: "", description: "", price_cents: 0, max_per_buyer: 4, sold: 0 };
}

function blankDraft(): EventDraftInput {
  return {
    title: "",
    description: "",
    category: "party",
    date: "",
    time: "",
    end_time: "",
    location: "",
    cover: COVER_PRESETS[0],
    photos: [],
    is_free: true,
    max_tickets: null,
    ticket_price: null,
    tiers: [emptyTier()],
    refund_policy: { type: "no_refunds" },
    status: "draft",
    host_type: "user",
    organization_id: null,
  };
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        {desc ? <p className="text-sm text-muted-foreground">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  // Organizations the user can host events for (officer tier).
  const { data: memberships } = useMyMemberships();
  const officerOrgs = (memberships ?? []).filter((m) => isOfficer(m.role) && m.organization);

  const { data: existing, isLoading: loadingExisting } = useHostEvent(isEdit ? id : undefined);
  const [draft, setDraft] = useState<EventDraftInput>(blankDraft);
  const [hydrated, setHydrated] = useState(false);

  // Prefill "host as organization" when arriving from the org dashboard (?org=ID).
  useEffect(() => {
    if (isEdit) return;
    const orgId = searchParams.get("org");
    if (!orgId || !officerOrgs.length) return;
    const m = officerOrgs.find((o) => o.organization_id === orgId);
    if (m && draft.organization_id !== orgId) {
      setDraft((d) => ({
        ...d,
        host_type: "organization",
        organization_id: orgId,
        org_name: m.organization?.name ?? null,
        org_logo: m.organization?.logo ?? null,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, officerOrgs.length, isEdit]);

  // Prefill in edit mode.
  useEffect(() => {
    if (!isEdit || hydrated || !existing) return;
    const tiers = eventTiers(existing);
    setDraft({
      title: existing.title ?? "",
      description: existing.description ?? "",
      category: existing.category ?? "party",
      date: existing.date ?? "",
      time: existing.time ?? "",
      end_time: existing.end_time ?? "",
      location: existing.location ?? "",
      cover: existing.photos?.[0] ?? COVER_PRESETS[0],
      photos: (existing.photos ?? []).slice(1),
      is_free: existing.is_free ?? true,
      max_tickets: existing.max_tickets ?? null,
      ticket_price: existing.ticket_price ?? null,
      tiers: tiers.length > 0 ? tiers : [emptyTier()],
      refund_policy: parseRefundPolicy(existing),
      status: (existing.status as EventStatus) ?? "draft",
      host_type: (existing.host_type as "user" | "organization") ?? "user",
      organization_id: existing.organization_id ?? null,
      org_name: existing.host_type === "organization" ? existing.host_data?.name ?? null : null,
      org_logo: existing.host_type === "organization" ? existing.host_data?.avatar ?? null : null,
    });
    setHydrated(true);
  }, [isEdit, existing, hydrated]);

  const set = <K extends keyof EventDraftInput>(key: K, value: EventDraftInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!draft.title.trim()) e.push("Title is required");
    if (!draft.description.trim()) e.push("Description is required");
    if (!draft.date) e.push("Date is required");
    if (!draft.time) e.push("Start time is required");
    if (!draft.location.trim()) e.push("Location is required");
    if (!draft.is_free && !draft.tiers.some((t) => t.name.trim() && t.price_cents > 0))
      e.push("Add at least one paid ticket tier with a name and price");
    return e;
  }, [draft]);

  const save = useMutation({
    mutationFn: async (status: EventStatus) => {
      if (!user) throw new Error("Not signed in");
      const payload: EventDraftInput = { ...draft, status };
      if (isEdit && id) return updateEvent(id, payload, profile, user.id);
      return createEvent(payload, profile, user.id);
    },
    onSuccess: (saved, status) => {
      toast.success(
        status === "published" ? "Event published! 🎉" : "Draft saved.",
      );
      navigate(status === "published" ? `/event/${saved.id}` : "/creator-dashboard?tab=events");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save event"),
  });

  const { run: gatePaidEvent, gate: paidEventGate } = useWaiverGate("create a paid event");

  function attempt(status: EventStatus) {
    if (status === "published" && errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    if (!draft.title.trim()) {
      toast.error("Add a title before saving.");
      return;
    }
    // Creating/publishing a PAID event is gated behind legal acceptance.
    if (!draft.is_free) {
      gatePaidEvent(() => save.mutate(status));
      return;
    }
    save.mutate(status);
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="container flex max-w-3xl justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <CalendarPlus className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">
            {isEdit ? "Edit event" : "Create an event"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? "Update your event details." : "Fill in the details and publish when ready."}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {officerOrgs.length > 0 ? (
          <Section title="Host as" desc="Post this event as yourself or on behalf of an organization.">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, host_type: "user", organization_id: null }))}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  draft.host_type === "user" ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                )}
              >
                <UserRound className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Myself</p>
                  <p className="text-xs text-muted-foreground">{profile?.name ?? "Your account"}</p>
                </div>
              </button>
              {officerOrgs.map((m) => (
                <button
                  key={m.organization_id}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      host_type: "organization",
                      organization_id: m.organization_id,
                      org_name: m.organization?.name ?? null,
                      org_logo: m.organization?.logo ?? null,
                    }))
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    draft.organization_id === m.organization_id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <Users2 className="h-5 w-5 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.organization?.name ?? "Organization"}</p>
                    <p className="text-xs text-muted-foreground">Organization event</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Cover image">
          <CoverPicker value={draft.cover} onChange={(url) => set("cover", url)} />
        </Section>

        <Section title="The basics">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event title</Label>
              <Input
                id="title"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Homecoming Tailgate 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Tell people what to expect…"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={draft.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {titleCase(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="When & where">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc">Location</Label>
              <Input
                id="loc"
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="The Quad, Main Campus"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Start time</Label>
              <Input id="start" type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End time</Label>
              <Input id="end" type="time" value={draft.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Tickets & capacity" desc="Free events take RSVPs. Paid events use ticket tiers.">
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  {draft.is_free ? <PartyPopper className="h-5 w-5" /> : <Ticket className="h-5 w-5" />}
                </span>
                <div>
                  <p className="font-semibold">{draft.is_free ? "Free event" : "Paid event"}</p>
                  <p className="text-sm text-muted-foreground">
                    {draft.is_free ? "Guests RSVP for free" : "Sell tickets across tiers"}
                  </p>
                </div>
              </div>
              <Switch checked={!draft.is_free} onCheckedChange={(v) => set("is_free", !v)} />
            </div>

            {draft.is_free ? (
              <div className="space-y-2">
                <Label htmlFor="cap">RSVP capacity (optional)</Label>
                <Input
                  id="cap"
                  type="number"
                  min={0}
                  value={draft.max_tickets ?? ""}
                  onChange={(e) => set("max_tickets", e.target.value ? Number(e.target.value) : null)}
                  placeholder="Unlimited"
                />
              </div>
            ) : (
              <>
                <TierEditor tiers={draft.tiers} onChange={(t) => set("tiers", t)} />
                <div className="space-y-2">
                  <Label htmlFor="overall">Overall capacity (optional)</Label>
                  <Input
                    id="overall"
                    type="number"
                    min={0}
                    value={draft.max_tickets ?? ""}
                    onChange={(e) => set("max_tickets", e.target.value ? Number(e.target.value) : null)}
                    placeholder="Total tickets across all tiers"
                  />
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="Refund policy">
          <div className="space-y-4">
            <Select
              value={draft.refund_policy.type}
              onValueChange={(v) =>
                set("refund_policy", { ...draft.refund_policy, type: v as typeof draft.refund_policy.type })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFUND_POLICIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} — {p.desc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {draft.refund_policy.type === "custom" ? (
              <Textarea
                value={draft.refund_policy.note ?? ""}
                onChange={(e) => set("refund_policy", { ...draft.refund_policy, note: e.target.value })}
                placeholder="Describe your refund terms…"
                rows={3}
              />
            ) : null}
          </div>
        </Section>

        {/* Actions */}
        <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => attempt("draft")}
            disabled={save.isPending}
            className="h-11"
          >
            {save.isPending && save.variables === "draft" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button onClick={() => attempt("published")} disabled={save.isPending} className="h-11 font-semibold">
            {save.isPending && save.variables === "published" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isEdit && existing?.status === "published" ? "Save & keep live" : "Publish event"}
          </Button>
        </div>
      </div>
      {paidEventGate}
    </div>
  );
}
