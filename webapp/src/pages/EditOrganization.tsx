import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ShieldX } from "lucide-react";
import { OrgForm } from "@/components/organizations/OrgForm";
import { useOrganization, useMyOrgRole, useOrgActions } from "@/hooks/useOrganizations";
import { isLeader } from "@/lib/organizations";
import { toast } from "sonner";

export default function EditOrganization() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: org, isLoading } = useOrganization(id);
  const { data: membership } = useMyOrgRole(id);
  const { update } = useOrgActions(id);

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-12">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState icon={ShieldX} title="Organization not found" description="It may have been removed." />
      </div>
    );
  }

  // Only presidents/admins may edit the profile.
  if (!isLeader(membership?.role)) {
    return (
      <div className="container max-w-2xl py-20">
        <EmptyState
          icon={ShieldX}
          title="Not allowed"
          description="Only the president can edit the organization profile."
          action={
            <Button asChild>
              <Link to={`/organizations/${org.id}`}>Back to organization</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 md:py-12">
      <Link
        to={`/organizations/${org.id}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {org.name}
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Pencil className="h-5 w-5" />
        </span>
        <h1 className="font-heading text-3xl font-extrabold">Edit organization</h1>
      </header>

      <OrgForm
        initial={org}
        submitting={update.isPending}
        submitLabel="Save changes"
        onSubmit={(input) =>
          update.mutate(
            { id: org.id, input },
            {
              onSuccess: () => {
                toast.success("Organization updated.");
                navigate(`/organizations/${org.id}`);
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save."),
            },
          )
        }
      />
    </div>
  );
}
