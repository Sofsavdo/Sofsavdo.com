"use client";

import { formatMoneyMinor } from "@sofsavdo/types";
import { Card, Skeleton } from "@sofsavdo/ui";
import { ShoppingBag, Banknote, HeartHandshake } from "lucide-react";
import { useActivityTicker } from "@/services/activity-ticker";
import type { ActivityEvent, ActivityEventType } from "@/lib/api";

const EVENT_META: Record<ActivityEventType, { icon: typeof ShoppingBag; verb: string }> = {
  SALE: { icon: ShoppingBag, verb: "sotuv qildi" },
  PAYOUT: { icon: Banknote, verb: "pul yechib oldi" },
  FUND_CONTRIBUTION: { icon: HeartHandshake, verb: "Creator Fund'ga hissa qo'shdi" },
};

// Coarse enough for a motivational ticker (nobody needs second-level precision here) — a tiny
// inline helper rather than a shared util, since this is the only caller in the codebase today.
function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "hozirgina";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  return `${days} kun oldin`;
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1.5">
      <Icon className="size-3.5 shrink-0 text-accent" />
      <span className="font-body text-xs text-text-primary">
        <strong className="font-medium">{event.creatorDisplayName}</strong> {meta.verb}{" "}
        <strong className="font-numeric tabular-nums">{formatMoneyMinor(event.amountMinor)}</strong>
      </span>
      <span className="font-body text-xs text-text-muted">· {timeAgo(event.occurredAt)}</span>
    </div>
  );
}

// A live-feeling activity feed — real sale/payout/fund-contribution events (see
// ActivityTickerService), not a fabricated animation. Renders as a horizontally scrollable strip
// rather than a JS-driven marquee, so an idle tab never spends CPU animating something nobody's
// watching (same performance-first mandate as every polled surface this session).
export function ActivityTicker() {
  const ticker = useActivityTicker();

  if (ticker.isLoading) return <Skeleton className="h-10 w-full" />;

  const events = ticker.data?.events ?? [];
  if (events.length === 0) return null;

  return (
    <Card className="overflow-x-auto p-2">
      <div className="flex items-center gap-2">
        {events.map((event, i) => (
          <ActivityRow key={`${event.type}-${event.occurredAt}-${i}`} event={event} />
        ))}
      </div>
    </Card>
  );
}
