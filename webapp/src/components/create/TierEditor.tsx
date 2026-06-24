import { Plus, Trash2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tier } from "@/lib/yardtix";

interface TierEditorProps {
  tiers: Tier[];
  onChange: (tiers: Tier[]) => void;
}

function newTier(i: number): Tier {
  return {
    id: `tier-${Date.now()}-${i}`,
    name: "",
    description: "",
    price_cents: 0,
    capacity: undefined,
    max_per_buyer: 4,
    sales_start: "",
    sales_end: "",
    sold: 0,
  };
}

export function TierEditor({ tiers, onChange }: TierEditorProps) {
  const update = (idx: number, patch: Partial<Tier>) =>
    onChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  const remove = (idx: number) => onChange(tiers.filter((_, i) => i !== idx));
  const add = () => onChange([...tiers, newTier(tiers.length)]);

  return (
    <div className="space-y-4">
      {tiers.map((tier, idx) => (
        <div key={tier.id} className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Ticket className="h-4 w-4 text-primary" />
              Tier {idx + 1}
            </span>
            {tiers.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => remove(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tier name</Label>
              <Input
                value={tier.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="General Admission, VIP…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={tier.description ?? ""}
                onChange={(e) => update(idx, { description: e.target.value })}
                placeholder="What’s included with this tier?"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Price (USD)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={tier.price_cents ? (tier.price_cents / 100).toString() : ""}
                  onChange={(e) =>
                    update(idx, { price_cents: Math.round(Number(e.target.value || 0) * 100) })
                  }
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input
                type="number"
                min={0}
                value={tier.capacity ?? ""}
                onChange={(e) =>
                  update(idx, { capacity: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max per buyer</Label>
              <Input
                type="number"
                min={1}
                value={tier.max_per_buyer ?? ""}
                onChange={(e) =>
                  update(idx, { max_per_buyer: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sales start</Label>
              <Input
                type="date"
                value={tier.sales_start ?? ""}
                onChange={(e) => update(idx, { sales_start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sales end</Label>
              <Input
                type="date"
                value={tier.sales_end ?? ""}
                onChange={(e) => update(idx, { sales_end: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-full border-dashed">
        <Plus className="h-4 w-4" />
        Add ticket tier
      </Button>
    </div>
  );
}
