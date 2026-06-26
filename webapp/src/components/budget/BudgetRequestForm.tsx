import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BUDGET_CATEGORIES, type BudgetLineItemInput, type BudgetRequestInput } from "@/lib/budgetRequests";
import { formatDollars } from "@/lib/helpers";
import type { BudgetRequest, BudgetRequestLineItem, Organization } from "@/lib/types";

interface Props {
  organizations: Organization[];
  initialRequest?: BudgetRequest | null;
  initialLineItems?: BudgetRequestLineItem[];
  defaultOrgId?: string | null;
  pending?: boolean;
  onSubmit: (input: BudgetRequestInput, lineItems: BudgetLineItemInput[]) => void;
}

const emptyLine = (): BudgetLineItemInput => ({
  item_name: "",
  description: "",
  quantity: 1,
  unit_cost_cents: 0,
  vendor: "",
  notes: "",
});

export function BudgetRequestForm({
  organizations,
  initialRequest,
  initialLineItems,
  defaultOrgId,
  pending,
  onSubmit,
}: Props) {
  const [input, setInput] = useState<BudgetRequestInput>({
    organization_id: initialRequest?.organization_id ?? defaultOrgId ?? organizations[0]?.id ?? "",
    title: initialRequest?.title ?? "",
    description: initialRequest?.description ?? "",
    linked_event_id: initialRequest?.linked_event_id ?? "",
    needed_by_date: initialRequest?.needed_by_date ?? "",
    category: (initialRequest?.category as BudgetRequestInput["category"]) ?? "event_supplies",
    purpose: initialRequest?.purpose ?? "",
    vendor_name: initialRequest?.vendor_name ?? "",
    vendor_email: initialRequest?.vendor_email ?? "",
    vendor_phone: initialRequest?.vendor_phone ?? "",
    vendor_website: initialRequest?.vendor_website ?? "",
    advisor_name: initialRequest?.advisor_name ?? "",
    advisor_email: initialRequest?.advisor_email ?? "",
  });
  const [items, setItems] = useState<BudgetLineItemInput[]>(
    initialLineItems?.length
      ? initialLineItems.map((item) => ({
          id: item.id,
          item_name: item.item_name,
          description: item.description ?? "",
          quantity: Number(item.quantity ?? 1),
          unit_cost_cents: item.unit_cost_cents ?? 0,
          vendor: item.vendor ?? "",
          notes: item.notes ?? "",
        }))
      : [emptyLine()],
  );

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(item.unit_cost_cents || 0)), 0),
    [items],
  );

  const set = (key: keyof BudgetRequestInput, value: string) => setInput((prev) => ({ ...prev, [key]: value }));
  const setItem = (idx: number, patch: Partial<BudgetLineItemInput>) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(input, items);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Organization</Label>
          <Select value={input.organization_id} onValueChange={(v) => set("organization_id", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Funding category</Label>
          <Select value={input.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_CATEGORIES.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Request title</Label>
        <Input value={input.title} onChange={(e) => set("title", e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={input.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Needed-by date</Label>
          <Input type="date" value={input.needed_by_date ?? ""} onChange={(e) => set("needed_by_date", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Linked event ID</Label>
          <Input value={input.linked_event_id ?? ""} onChange={(e) => set("linked_event_id", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Total requested</Label>
          <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 font-semibold">
            {formatDollars(total / 100)}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Purpose</Label>
        <Textarea value={input.purpose} onChange={(e) => set("purpose", e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Vendor name</Label>
          <Input value={input.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Vendor email</Label>
          <Input value={input.vendor_email} onChange={(e) => set("vendor_email", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Vendor phone</Label>
          <Input value={input.vendor_phone} onChange={(e) => set("vendor_phone", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Vendor website</Label>
          <Input value={input.vendor_website} onChange={(e) => set("vendor_website", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Advisor name</Label>
          <Input value={input.advisor_name} onChange={(e) => set("advisor_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Advisor email</Label>
          <Input value={input.advisor_email} onChange={(e) => set("advisor_email", e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold">Line items</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyLine()])}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-3">
              <div className="grid gap-3 md:grid-cols-[1.5fr_0.6fr_0.8fr_0.8fr_auto]">
                <Input
                  placeholder="Item name"
                  value={item.item_name}
                  onChange={(e) => setItem(idx, { item_name: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(item.unit_cost_cents / 100).toString()}
                  onChange={(e) => setItem(idx, { unit_cost_cents: Math.round(Number(e.target.value || 0) * 100) })}
                />
                <div className="flex h-10 items-center rounded-md bg-muted px-3 text-sm">
                  {formatDollars((Number(item.quantity || 0) * Number(item.unit_cost_cents || 0)) / 100)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={items.length === 1}
                  aria-label="Remove line item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Input placeholder="Description" value={item.description} onChange={(e) => setItem(idx, { description: e.target.value })} />
                <Input placeholder="Vendor" value={item.vendor} onChange={(e) => setItem(idx, { vendor: e.target.value })} />
                <Input placeholder="Notes" value={item.notes} onChange={(e) => setItem(idx, { notes: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={pending || organizations.length === 0}>
        <Save className="h-4 w-4" />
        Save request
      </Button>
    </form>
  );
}
