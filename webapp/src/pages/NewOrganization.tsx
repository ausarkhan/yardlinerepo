import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Users2 } from "lucide-react";
import { OrgForm } from "@/components/organizations/OrgForm";
import { useOrgActions } from "@/hooks/useOrganizations";
import { toast } from "sonner";

export default function NewOrganization() {
  const navigate = useNavigate();
  const { create } = useOrgActions();

  return (
    <div className="container max-w-2xl py-8 md:py-12">
      <Link
        to="/organizations"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All organizations
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Users2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Start an organization</h1>
          <p className="text-sm text-muted-foreground">You'll become the president and can add officers and members.</p>
        </div>
      </header>

      <OrgForm
        submitting={create.isPending}
        submitLabel="Create organization"
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: (org) => {
              toast.success("Organization created! 🎉");
              navigate(`/organizations/${org.id}`);
            },
            onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create organization."),
          })
        }
      />
    </div>
  );
}
