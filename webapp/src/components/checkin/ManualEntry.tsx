import { useState } from "react";
import { Keyboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ManualEntryProps {
  onSubmit: (ticketNumber: string) => void;
  pending?: boolean;
}

// Manual ticket-number entry — the no-camera fallback. Works with or without
// camera permission so a host is never blocked at the door.
export function ManualEntry({ onSubmit, pending }: ManualEntryProps) {
  const [value, setValue] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Keyboard className="h-4 w-4" />
        Enter ticket number
      </label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="YT-2026-123456"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="h-11 font-mono"
        />
        <Button type="submit" disabled={pending || value.trim().length === 0} className="h-11 min-w-[88px]">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in"}
        </Button>
      </div>
    </form>
  );
}
