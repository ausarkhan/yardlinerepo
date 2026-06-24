import { Link } from "react-router-dom";
import { ScrollText, ShieldCheck } from "lucide-react";
import { LEGAL_CONTENT } from "@/lib/legalContent";
import { LEGAL_VERSIONS } from "@/lib/waivers";
import type { LegalDocument } from "@/lib/types";

// Renders one legal document. Reachable publicly at /terms, /privacy, /waiver.
export function LegalPage({ document }: { document: LegalDocument }) {
  const content = LEGAL_CONTENT[document];
  return (
    <div className="container max-w-2xl py-10 md:py-14">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ShieldCheck className="h-4 w-4" />
        YardLine
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ScrollText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold">{content.title}</h1>
          <p className="text-xs text-muted-foreground">Version {LEGAL_VERSIONS[document]}</p>
        </div>
      </header>

      <p className="mb-8 leading-relaxed text-muted-foreground">{content.intro}</p>

      <div className="space-y-6">
        {content.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-1.5 font-heading text-lg font-bold">{s.heading}</h2>
            <p className="leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
        <Link to="/terms" className="text-muted-foreground hover:text-foreground">
          Terms
        </Link>
        <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
          Privacy
        </Link>
        <Link to="/waiver" className="text-muted-foreground hover:text-foreground">
          Waiver
        </Link>
      </div>
    </div>
  );
}
