import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera,
  Loader2,
  Mail,
  MapPin,
  CalendarDays,
  BadgeCheck,
  Save,
  AtSign,
  Image,
  Link as LinkIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth";
import { updateProfile, uploadAvatar, uploadProfileImage } from "@/lib/auth";
import { avatarUrl, initials, formatEventDate } from "@/lib/helpers";
import { toast } from "sonner";

export default function Profile() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.name ?? "");
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [campus, setCampus] = useState(profile?.campus ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [website, setWebsite] = useState(profile?.social_links?.website ?? "");
  const [instagram, setInstagram] = useState(profile?.social_links?.instagram ?? "");
  const [linkedin, setLinkedin] = useState(profile?.social_links?.linkedin ?? "");
  const [uploading, setUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setHandle(profile.handle ?? "");
    setCampus(profile.campus ?? "");
    setBio(profile.bio ?? "");
    setWebsite(profile.social_links?.website ?? "");
    setInstagram(profile.social_links?.instagram ?? "");
    setLinkedin(profile.social_links?.linkedin ?? "");
  }, [profile]);

  const dirty =
    name !== (profile?.name ?? "") ||
    handle !== (profile?.handle ?? "") ||
    campus !== (profile?.campus ?? "") ||
    bio !== (profile?.bio ?? "") ||
    website !== (profile?.social_links?.website ?? "") ||
    instagram !== (profile?.social_links?.instagram ?? "") ||
    linkedin !== (profile?.social_links?.linkedin ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      // name / handle / campus are NOT NULL in the database — never send null.
      return updateProfile(user.id, {
        name: name.trim() || "Member",
        handle: handle.trim() || "@member",
        campus: campus.trim(),
        bio: bio.trim() || null,
        social_links: {
          website: website.trim(),
          instagram: instagram.trim(),
          linkedin: linkedin.trim(),
        },
      });
    },
    onSuccess: (updated) => {
      setProfile(updated);
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save profile"),
  });

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      const updated = await updateProfile(user.id, { avatar: url });
      setProfile(updated);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setBannerUploading(true);
    try {
      const url = await uploadProfileImage(user.id, file, "banner");
      const updated = await updateProfile(user.id, { banner: url });
      setProfile(updated);
      toast.success("Banner updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBannerUploading(false);
      if (bannerRef.current) bannerRef.current.value = "";
    }
  }

  const displayName = name || profile?.name || "Your name";

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <h1 className="mb-8 font-heading text-3xl font-extrabold md:text-4xl">Your profile</h1>

      {/* Identity card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        {profile?.banner && avatarUrl(profile.banner) ? (
          <img src={avatarUrl(profile.banner)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : (
          <div className="bg-field absolute inset-0 opacity-60" />
        )}
        <div className="relative mb-4 flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => bannerRef.current?.click()} disabled={bannerUploading}>
            {bannerUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
            Banner
          </Button>
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={onBanner} />
        </div>
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background shadow-md">
              <AvatarImage src={avatarUrl(profile?.avatar)} alt={displayName} />
              <AvatarFallback className="bg-secondary text-2xl font-bold text-secondary-foreground">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
              aria-label="Change avatar"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatar}
            />
          </div>
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h2 className="font-heading text-2xl font-bold">{displayName}</h2>
              {profile?.is_provider ? (
                <Badge className="border-0 bg-green text-white">
                  <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                  Provider
                </Badge>
              ) : null}
            </div>
            {profile?.handle ? (
              <p className="text-muted-foreground">{profile.handle}</p>
            ) : null}
            {profile?.bio ? <p className="mt-2 max-w-xl text-sm text-muted-foreground">{profile.bio}</p> : null}
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-5 font-heading text-lg font-bold">Edit information</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="handle"
                value={handle.replace(/^@/, "")}
                onChange={(e) => setHandle(`@${e.target.value.replace(/^@/, "")}`)}
                className="h-11 pl-9"
                placeholder="yourhandle"
              />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="campus">Campus</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="campus"
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                className="h-11 pl-9"
                placeholder="Your school or campus"
              />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              placeholder="A short intro for classmates, hosts, and organizations"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Social links
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" />
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" />
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="LinkedIn" />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="h-11 font-semibold">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>

      {/* Account details */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-5 font-heading text-lg font-bold">Account details</h3>
        <dl className="divide-y divide-border">
          <div className="flex items-center gap-3 py-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <dt className="w-32 text-sm text-muted-foreground">Email</dt>
            <dd className="font-medium">{profile?.email || user?.email || "—"}</dd>
          </div>
          <div className="flex items-center gap-3 py-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <dt className="w-32 text-sm text-muted-foreground">Joined</dt>
            <dd className="font-medium">
              {profile?.joined_date ? formatEventDate(profile.joined_date, { withYear: true }) : "—"}
            </dd>
          </div>
          <div className="flex items-center gap-3 py-3">
            <BadgeCheck className="h-5 w-5 text-muted-foreground" />
            <dt className="w-32 text-sm text-muted-foreground">Account type</dt>
            <dd className="font-medium">{profile?.is_provider ? "Provider" : "Member"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
