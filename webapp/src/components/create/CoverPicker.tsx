import { useState } from "react";
import { Check, Link2, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartImage } from "@/components/common/SmartImage";
import { COVER_PRESETS } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface CoverPickerProps {
  value: string;
  onChange: (url: string) => void;
}

export function CoverPicker({ value, onChange }: CoverPickerProps) {
  const isCustom = value.length > 0 && !COVER_PRESETS.includes(value);
  const [url, setUrl] = useState(isCustom ? value : "");

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-muted">
          <SmartImage src={value} alt="Cover preview" className="h-full w-full object-cover" />
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
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Choose a cover
        </Label>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {COVER_PRESETS.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => onChange(src)}
              className={cn(
                "relative aspect-[16/10] overflow-hidden rounded-lg border-2 transition-all",
                value === src ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border",
              )}
            >
              <SmartImage src={src} alt="" className="h-full w-full object-cover" />
              {value === src ? (
                <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
                  <Check className="h-5 w-5 text-white drop-shadow" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover-url" className="text-xs uppercase tracking-wide text-muted-foreground">
          Or paste an image URL
        </Label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="cover-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => url.trim() && onChange(url.trim())}
            placeholder="https://…/photo.jpg"
            className="pl-9"
          />
        </div>
      </div>
    </div>
  );
}
