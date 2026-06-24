import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderImagePicker } from "@/components/services/ProviderImagePicker";
import { useAuthStore } from "@/store/auth";
import { useMyProviderProfile } from "@/hooks/useProviderProfile";
import { useWaiverGate } from "@/hooks/useWaiverGate";
import { saveProviderProfile, type ProviderProfileInput } from "@/lib/services";
import { PROVIDER_CATEGORIES, PROVIDER_COVER_PRESETS, titleCase } from "@/lib/helpers";
import { toast } from "sonner";

const RESPONSE_TIMES = ["< 1 hour", "< 3 hours", "< 1 day", "1–2 days", "within a week"];

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5">
        <h3 className="font-heading text-lg font-bold">{title}</h3>
        {desc ? <p className="text-sm text-muted-foreground">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

function blankInput(): ProviderProfileInput {
  return {
    category: "barbers",
    description: "",
    response_time: "< 1 day",
    is_available: true,
    cover: PROVIDER_COVER_PRESETS[0],
    photos: [],
  };
}

interface ProviderProfileFormProps {
  // Called after a successful save (e.g. to close a dialog).
  onSaved?: () => void;
  // Optional cancel affordance (e.g. dialog close).
  onCancel?: () => void;
}

// Create / edit the signed-in user's provider profile. Extracted from the old
// standalone /provider-setup page so it can live inside the Creator Dashboard.
export function ProviderProfileForm({ onSaved, onCancel }: ProviderProfileFormProps) {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);
  const qc = useQueryClient();

  const { data: existing } = useMyProviderProfile();
  const isEdit = !!existing;
  const [draft, setDraft] = useState<ProviderProfileInput>(blankInput);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !existing) return;
    const photos = (existing.photos ?? []).filter((p) => p && p.trim().length > 0);
    setDraft({
      category: existing.category ?? "barbers",
      description: existing.description ?? "",
      response_time: existing.response_time ?? "< 1 day",
      is_available: existing.is_available ?? true,
      cover: photos[0] ?? PROVIDER_COVER_PRESETS[0],
      photos: photos.slice(1),
    });
    setHydrated(true);
  }, [existing, hydrated]);

  const set = <K extends keyof ProviderProfileInput>(key: K, value: ProviderProfileInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const error = useMemo(() => {
    if (!draft.category) return "Pick a category";
    if (!draft.description.trim()) return "Add a short description of what you offer";
    return null;
  }, [draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      return saveProviderProfile(draft, profile, user.id);
    },
    onSuccess: () => {
      if (profile) setProfile({ ...profile, is_provider: true });
      qc.invalidateQueries({ queryKey: ["my-provider", user?.id] });
      qc.invalidateQueries({ queryKey: ["providers"] });
      toast.success(isEdit ? "Provider profile updated" : "You’re live as a provider! 🎉");
      onSaved?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save profile"),
  });

  const { run: gateProvider, gate: providerGate } = useWaiverGate("become a provider");

  function submit() {
    if (error) {
      toast.error(error);
      return;
    }
    // Becoming a provider for the first time is gated behind legal acceptance.
    if (!isEdit) {
      gateProvider(() => save.mutate());
      return;
    }
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <Section title="Your storefront photos">
        <ProviderImagePicker
          cover={draft.cover}
          gallery={draft.photos}
          onCoverChange={(url) => set("cover", url)}
          onGalleryChange={(urls) => set("photos", urls)}
        />
      </Section>

      <Section title="About your service">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={draft.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {titleCase(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prov-desc">Description</Label>
            <Textarea
              id="prov-desc"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Tell students what you offer, your style, where you’re based…"
              rows={4}
            />
          </div>
        </div>
      </Section>

      <Section title="Availability">
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="font-semibold">Accepting bookings</p>
              <p className="text-sm text-muted-foreground">
                Turn off to pause new requests without hiding your page.
              </p>
            </div>
            <Switch checked={draft.is_available} onCheckedChange={(v) => set("is_available", v)} />
          </div>
          <div className="space-y-2">
            <Label>Typical response time</Label>
            <Select value={draft.response_time} onValueChange={(v) => set("response_time", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_TIMES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={save.isPending} className="h-11">
            Cancel
          </Button>
        ) : null}
        <Button onClick={submit} disabled={save.isPending} className="h-11 font-semibold">
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEdit ? (
            <Save className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isEdit ? "Save changes" : "Go live"}
        </Button>
      </div>
      {providerGate}
    </div>
  );
}
