import { useState } from "react";
import { Ban, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RatingBadge } from "@/components/reviews/RatingBadge";
import { ModerationActionDialog } from "./ModerationActionDialog";
import { useAdminProviders, useModerationActions } from "@/hooks/useAdmin";
import { providerName, avatarUrl, initials, titleCase } from "@/lib/helpers";
import type { AdminProviderRow } from "@/lib/admin";
import { toast } from "sonner";

export function AdminProvidersTable() {
  const { data: rows, isLoading } = useAdminProviders(0);
  const { setProviderHidden } = useModerationActions();
  const [target, setTarget] = useState<AdminProviderRow | null>(null);

  const onConfirm = (reason: string) => {
    if (!target) return;
    const hide = !target.provider.is_hidden;
    setProviderHidden.mutate(
      { providerRowId: target.provider.id, hidden: hide, reason },
      {
        onSuccess: () => {
          toast.success(hide ? "Provider disabled." : "Provider restored.");
          setTarget(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead className="hidden sm:table-cell">Rating</TableHead>
              <TableHead className="hidden md:table-cell">Bookings</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No providers.
                </TableCell>
              </TableRow>
            ) : (
              (rows ?? []).map(({ provider, rating, reviewCount, bookingVolume }) => (
                <TableRow key={provider.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={avatarUrl(provider.user_data?.avatar)} alt={providerName(provider)} />
                        <AvatarFallback className="text-xs">{initials(providerName(provider))}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{providerName(provider)}</p>
                        <p className="truncate text-xs text-muted-foreground">{titleCase(provider.category)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <RatingBadge average={rating} count={reviewCount} size="sm" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{bookingVolume}</TableCell>
                  <TableCell>
                    {provider.is_hidden ? (
                      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                        Disabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-green/30 bg-green/10 text-green">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={provider.is_hidden ? "outline" : "destructive"}
                      onClick={() => setTarget({ provider, rating, reviewCount, bookingVolume })}
                    >
                      {provider.is_hidden ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </>
                      ) : (
                        <>
                          <Ban className="h-3.5 w-3.5" /> Disable
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ModerationActionDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.provider.is_hidden ? "Restore provider" : "Disable provider"}
        description={
          target?.provider.is_hidden
            ? `Make ${providerName(target.provider)} visible and bookable again.`
            : `Disable ${target ? providerName(target.provider) : "this provider"}. Their listing is hidden; data is preserved.`
        }
        confirmLabel={target?.provider.is_hidden ? "Restore" : "Disable"}
        destructive={!target?.provider.is_hidden}
        pending={setProviderHidden.isPending}
        onConfirm={onConfirm}
      />
    </div>
  );
}
