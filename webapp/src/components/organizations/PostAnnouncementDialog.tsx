import { useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useOrgActions } from "@/hooks/useOrganizations";
import type { OrgAnnouncementVisibility } from "@/lib/types";
import { toast } from "sonner";

export function PostAnnouncementDialog({ orgId }: { orgId: string }) {
  const { announce } = useOrgActions(orgId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<OrgAnnouncementVisibility>("public");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Add a title.");
      return;
    }
    announce.mutate(
      { title, body, visibility },
      {
        onSuccess: () => {
          toast.success("Announcement posted.");
          setTitle("");
          setBody("");
          setVisibility("public");
          setOpen(false);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't post."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Megaphone className="h-4 w-4" />
          Post announcement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>Share an update with your organization.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Message</Label>
            <Textarea id="ann-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Who can see this?</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as OrgAnnouncementVisibility)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — anyone</SelectItem>
                <SelectItem value="members">Members only</SelectItem>
                <SelectItem value="officers">Officers only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={announce.isPending}>
            {announce.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
