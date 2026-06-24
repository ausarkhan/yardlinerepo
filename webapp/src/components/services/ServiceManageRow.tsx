import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuthStore } from "@/store/auth";
import { setServiceActive, deleteService } from "@/lib/services";
import type { Service } from "@/lib/types";
import { formatPrice } from "@/lib/helpers";
import { toast } from "sonner";

interface ServiceManageRowProps {
  service: Service;
  onEdit: (service: Service) => void;
}

export function ServiceManageRow({ service, onEdit }: ServiceManageRowProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-services", userId] });
    qc.invalidateQueries({ queryKey: ["provider-services"] });
  };

  const toggle = useMutation({
    mutationFn: (active: boolean) => setServiceActive(service.service_id, active),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const remove = useMutation({
    mutationFn: () => deleteService(service.service_id),
    onSuccess: () => {
      invalidate();
      toast.success("Service removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const active = service.active ?? true;

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{service.name ?? "Service"}</p>
          {!active ? (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Hidden
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{formatPrice(service.price_cents)}</span>
          {service.duration ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {service.duration} min
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={active}
          onCheckedChange={(v) => toggle.mutate(v)}
          disabled={toggle.isPending}
          aria-label="Toggle active"
        />
        <Button variant="ghost" size="icon" onClick={() => onEdit(service)} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete">
              {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this service?</AlertDialogTitle>
              <AlertDialogDescription>
                “{service.name}” will be removed from your menu. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
