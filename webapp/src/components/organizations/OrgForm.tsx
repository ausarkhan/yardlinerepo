import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORG_CATEGORIES, type OrgInput } from "@/lib/organizations";
import type { OrgCategory, Organization } from "@/lib/types";

interface OrgFormProps {
  initial?: Organization | null;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (input: OrgInput) => void;
}

function emptyInput(o?: Organization | null): OrgInput {
  return {
    name: o?.name ?? "",
    description: o?.description ?? "",
    category: (o?.category as OrgCategory) ?? "academic",
    mission: o?.mission ?? "",
    logo: o?.logo ?? "",
    cover: o?.cover ?? "",
    contact_email: o?.contact_email ?? "",
    social_links: (o?.social_links as Record<string, string>) ?? {},
    advisor_name: o?.advisor_name ?? "",
    advisor_email: o?.advisor_email ?? "",
    department: o?.department ?? "",
  };
}

export function OrgForm({ initial, submitting, submitLabel, onSubmit }: OrgFormProps) {
  const [draft, setDraft] = useState<OrgInput>(emptyInput(initial));
  const set = <K extends keyof OrgInput>(k: K, v: OrgInput[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setSocial = (k: string, v: string) =>
    setDraft((d) => ({ ...d, social_links: { ...d.social_links, [k]: v } }));

  const submit = () => {
    if (!draft.name.trim()) return;
    onSubmit(draft);
  };

  return (
    <div className="space-y-6">
      <Section title="Basics">
        <Field label="Organization name" required>
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Robotics Club" />
        </Field>
        <Field label="Category" required>
          <Select value={draft.category} onValueChange={(v) => set("category", v as OrgCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORG_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Short description">
          <Textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What is your organization about?"
            rows={3}
          />
        </Field>
        <Field label="Mission statement">
          <Textarea
            value={draft.mission}
            onChange={(e) => set("mission", e.target.value)}
            placeholder="Your mission and goals"
            rows={3}
          />
        </Field>
      </Section>

      <Section title="Branding">
        <Field label="Logo URL">
          <Input value={draft.logo} onChange={(e) => set("logo", e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Cover image URL">
          <Input value={draft.cover} onChange={(e) => set("cover", e.target.value)} placeholder="https://…" />
        </Field>
      </Section>

      <Section title="Contact & advisor">
        <Field label="Contact email">
          <Input
            type="email"
            value={draft.contact_email}
            onChange={(e) => set("contact_email", e.target.value)}
            placeholder="club@campus.edu"
          />
        </Field>
        <Field label="Campus department">
          <Input value={draft.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Engineering" />
        </Field>
        <Field label="Advisor name">
          <Input value={draft.advisor_name} onChange={(e) => set("advisor_name", e.target.value)} />
        </Field>
        <Field label="Advisor email">
          <Input
            type="email"
            value={draft.advisor_email}
            onChange={(e) => set("advisor_email", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Social links">
        <Field label="Website">
          <Input
            value={draft.social_links.website ?? ""}
            onChange={(e) => setSocial("website", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Instagram">
          <Input
            value={draft.social_links.instagram ?? ""}
            onChange={(e) => setSocial("instagram", e.target.value)}
            placeholder="@handle"
          />
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting || !draft.name.trim()} className="h-11 font-semibold">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-heading text-lg font-bold">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
