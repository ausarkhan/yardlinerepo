import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store/auth";
import { createService, updateService, type ServiceInput } from "@/lib/services";
import type { Service } from "@/lib/types";
import { toast } from "sonner";

interface ServiceEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null; // present = edit
}

export function ServiceEditorDialog({ open, onOpenChange, service }: ServiceEditorDialogProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const isEdit = !!service;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(""); // dollars
  const [duration, setDuration] = useState("60");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setPrice(service?.price_cents != null ? (service.price_cents / 100).toString() : "");
    setDuration(service?.duration != null ? String(service.duration) : "60");
    setActive(service?.active ?? true);
  }, [open, service]);

  const save = useMutation({
    mutationFn: async () => {
      const input: ServiceInput = {
        name: name.trim(),
        description: description.trim(),
        price_cents: Math.round(parseFloat(price || "0") * 100),
        duration: parseInt(duration || "0", 10),
        active,
      };
      if (!input.name) throw new Error("Give your service a name.");
      if (!(input.price_cents > 0)) throw new Error("Set a price greater than $0.");
      if (isEdit && service) return updateService(service.service_id, input);
      if (!userId) throw new Error("Not signed in");
      return createService(input, userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-services", userId] });
      qc.invalidateQueries({ queryKey: ["provider-services"] });
      toast.success(isEdit ? "Service updated" : "Service added");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save service"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit service" : "Add a service"}</DialogTitle>
          <DialogDescription>Set what you offer, the price, and how long it takes.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="svc-name">Service name</Label>
            <Input
              id="svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Haircut & line-up"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc-desc">Description (optional)</Label>
            <Textarea
              id="svc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What’s included…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="svc-price">Price (USD)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="25"
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-duration">Duration (min)</Label>
              <Input
                id="svc-duration"
                type="number"
                min={0}
                step="5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-semibold">Active</p>
              <p className="text-xs text-muted-foreground">Visible and bookable on your page.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="font-semibold">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save" : "Add service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
