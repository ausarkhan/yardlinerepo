import { titleCase } from "@/lib/helpers";
import { cn } from "@/lib/utils";

interface CategoryChipsProps {
  categories: string[];
  active: string;
  onChange: (value: string) => void;
}

// Horizontal, scrollable pill filter. "all" is always first.
export function CategoryChips({ categories, active, onChange }: CategoryChipsProps) {
  const all = ["all", ...categories];
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {all.map((cat) => {
        const isActive = active === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {cat === "all" ? "All" : titleCase(cat)}
          </button>
        );
      })}
    </div>
  );
}
