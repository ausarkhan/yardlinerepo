import { useState } from "react";
import { Check, Link2, ImageIcon, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/common/SmartImage";
import { PROVIDER_COVER_PRESETS, isUsableUrl } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface ProviderImagePickerProps {
  cover: string;
  gallery: string[];
  onCoverChange: (url: string) => void;
  onGalleryChange: (urls: string[]) => void;
}

export function ProviderImagePicker({
  cover,
  gallery,
  onCoverChange,
  onGalleryChange,
}: ProviderImagePickerProps) {
  const isCustom = cover.length > 0 && !PROVIDER_COVER_PRESETS.includes(cover);
  const [url, setUrl] = useState(isCustom ? cover : "");
  const [galleryUrl, setGalleryUrl] = useState("");

  function addGallery() {
    const v = galleryUrl.trim();
    if (!isUsableUrl(v)) return;
    if (gallery.includes(v)) {
      setGalleryUrl("");
      return;
    }
    onGalleryChange([...gallery, v]);
    setGalleryUrl("");
  }

  return (
    <div className="space-y-5">
      {cover ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-muted">
          <SmartImage src={cover} alt="Cover preview" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm">Choose a cover below</p>
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cover photo</Label>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {PROVIDER_COVER_PRESETS.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => onCoverChange(src)}
              className={cn(
                "relative aspect-[16/10] overflow-hidden rounded-lg border-2 transition-all",
                cover === src
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent hover:border-border",
              )}
            >
              <SmartImage src={src} alt="" className="h-full w-full object-cover" />
              {cover === src ? (
                <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                  <Check className="h-5 w-5 text-white drop-shadow" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prov-cover-url" className="text-xs uppercase tracking-wide text-muted-foreground">
          Or paste a cover image URL
        </Label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="prov-cover-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => url.trim() && onCoverChange(url.trim())}
            placeholder="https://…/photo.jpg"
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Work gallery (optional)
        </Label>
        {gallery.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {gallery.map((src) => (
              <div
                key={src}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                <SmartImage src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onGalleryChange(gallery.filter((g) => g !== src))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={galleryUrl}
            onChange={(e) => setGalleryUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGallery();
              }
            }}
            placeholder="Paste an image URL and press Add"
            className="pl-9 pr-20"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addGallery}
            className="absolute right-1 top-1/2 -translate-y-1/2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
