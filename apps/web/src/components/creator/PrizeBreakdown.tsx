import { cn } from "@sofsavdo/ui";

// CompetitionResponse.prizeDescription is a single " · "-joined string (see
// CompetitionsService.buildPrizeDescription) — was rendered as one wrapping paragraph, which reads
// as a jumbled run-on on narrow screens ("1-o'rin: 500$ · 2-" wrapping mid-phrase). Splitting back
// into one row per place reads cleanly at any width, and needs no backend change since the
// delimiter is already stable.
export function PrizeBreakdown({ prizeDescription, className }: { prizeDescription: string; className?: string }) {
  const parts = prizeDescription.split(" · ").filter(Boolean);
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-input border border-accent/20 bg-accent/5 p-3", className)}>
      {parts.map((part) => (
        <p key={part} className="font-body text-sm text-text-primary">
          {part}
        </p>
      ))}
    </div>
  );
}
