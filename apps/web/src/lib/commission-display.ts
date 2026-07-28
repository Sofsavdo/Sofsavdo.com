import type { Campaign } from "@rosti/types";
import { formatMoneyMinor, formatPercent } from "@rosti/types";

// Unambiguous per-mode display — "15% per qualified sale" or "150,000 UZS per qualified sale",
// never both at once (see DECISIONS.md ADR-013's PERCENTAGE|FIXED_AMOUNT mutual exclusivity).
export function formatCommission(
  campaign: Pick<Campaign, "commissionType" | "commissionRateBps" | "commissionAmountMinor" | "commissionCurrency">,
): string {
  switch (campaign.commissionType) {
    case "PERCENTAGE":
      return `${formatPercent(campaign.commissionRateBps ?? 0)} / sotuv`;
    case "FIXED_AMOUNT":
      return `${formatMoneyMinor(campaign.commissionAmountMinor ?? 0, campaign.commissionCurrency)} / sotuv`;
  }
}

// AdminCommission (a settled commission ledger record — Order/Commission domain, mock-only today)
// snapshots a single `commissionValue` at the time it was calculated, unlike Campaign's dual
// commissionRateBps/commissionAmountMinor fields — so it needs its own tiny formatter rather than
// reusing formatCommission above.
export function formatCommissionValue(commissionType: "PERCENTAGE" | "FIXED_AMOUNT", commissionValue: number): string {
  return commissionType === "PERCENTAGE" ? formatPercent(commissionValue) : formatMoneyMinor(commissionValue);
}

export function formatDeadline(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  // A malformed/empty deadline (real fixtures observed in a shared test database — see
  // PROJECT_STATUS.md) produces an Invalid Date, and NaN silently fails every numeric
  // comparison below it, falling through to the last branch as the literal string "NaN kun
  // qoldi" — a visibly broken label rather than a graceful fallback.
  if (Number.isNaN(days)) return "Muddat noma'lum";
  if (days < 0) return "Muddati tugagan";
  if (days === 0) return "Bugun tugaydi";
  return `${days} kun qoldi`;
}

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  TELEGRAM: "Telegram",
};

export function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] ?? p;
}
