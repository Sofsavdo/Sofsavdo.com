import { ShoppingBag } from "lucide-react";
import type { PublicActivityEvent } from "@/lib/api";

// Coarse relative time, same convention as the creator-facing ActivityTicker's own inline helper
// (not shared — that one operates on a different event shape and is client-side/live-polled,
// this one is computed once at request time since the homepage is a Server Component).
function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "hozirgina";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  return `${Math.min(hours, 23)} soat oldin`;
}

const SLOT_SECONDS = 4;

// Real, honest FOMO signal (PublicActivityService — last few actually-PAID/DELIVERED orders,
// anonymized to just an offer name + city, never a name/amount/anything Commission-related) — not
// a fabricated "N people are viewing this" counter, which docs/PROHIBITED.md's "fabricated stats"
// rule would ban outright. Pure-CSS cross-fade cycle rather than a JS interval/marquee, so this
// stays a genuine Server Component with zero client JS — matching this page's own "Server
// Components preferred" mandate — while still giving the "animatsiya" motion the homepage was
// otherwise missing.
//
// The keyframe percentages below are computed here (server-side, once per request) rather than
// hardcoded in a static CSS file, because a shared `@keyframes` rule's `0%..100%` stops are fixed
// numbers — CSS has no `calc()`/custom-property support inside a keyframe selector, so there is no
// way to write one static rule that correctly divides its 0-100% cycle into N equal, non-
// overlapping "visible" slots for a dynamic N. Every item shares the same `animation-duration`
// (the full loop) and is offset only by `animation-delay`, so the same per-slot fade-in/hold/fade-
// out fractions apply to all of them identically. Renders nothing when the feed is empty (no real
// orders yet), same honest-empty-state convention as FeaturedProducts.
export function RecentActivityTicker({ events }: { events: PublicActivityEvent[] }) {
  if (events.length === 0) return null;

  const n = events.length;
  const slotPct = 100 / n;
  const fadeInEnd = (slotPct * 0.12).toFixed(2);
  const fadeOutStart = (slotPct * 0.88).toFixed(2);
  const slotEnd = slotPct.toFixed(2);
  const totalDuration = n * SLOT_SECONDS;

  return (
    <div className="mx-auto max-w-7xl px-pad-mobile md:px-pad-desktop">
      <style>{`
        @keyframes sofsavdo-ticker-fade {
          0% { opacity: 0; }
          ${fadeInEnd}% { opacity: 1; }
          ${fadeOutStart}% { opacity: 1; }
          ${slotEnd}%, 100% { opacity: 0; }
        }
      `}</style>
      <div className="relative h-11 overflow-hidden rounded-full border border-border bg-surface">
        {events.map((event, i) => (
          <div
            key={`${event.offerName}-${event.occurredAt}-${i}`}
            className="absolute inset-0 flex items-center justify-center gap-2 px-4 opacity-0 [animation-iteration-count:infinite] [animation-name:sofsavdo-ticker-fade] [animation-timing-function:ease-in-out]"
            style={{ animationDuration: `${totalDuration}s`, animationDelay: `${i * SLOT_SECONDS}s` }}
          >
            <ShoppingBag className="size-3.5 shrink-0 text-accent" aria-hidden />
            <span className="truncate font-body text-xs text-text-primary">
              {event.city ? <strong className="font-medium">{event.city}</strong> : null}
              {event.city ? " — " : null}
              <strong className="font-medium">{event.offerName}</strong> buyurtma qilindi
            </span>
            <span className="shrink-0 font-body text-xs text-text-muted">· {timeAgo(event.occurredAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
