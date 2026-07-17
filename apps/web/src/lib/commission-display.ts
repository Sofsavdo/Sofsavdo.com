import type { Campaign } from "@rosti/types";
import { formatMoneyMinor, formatPercent } from "@rosti/types";

export function formatCommission(campaign: Pick<Campaign, "commissionType" | "commissionValue" | "fixedPaymentMinor">): string {
  switch (campaign.commissionType) {
    case "PERCENTAGE":
      return `${formatPercent(campaign.commissionValue)} komissiya`;
    case "FIXED_PER_SALE":
      return `${formatMoneyMinor(campaign.commissionValue)} / sotuv`;
    case "FIXED_CONTENT_FEE":
      return `${formatMoneyMinor(campaign.fixedPaymentMinor ?? 0)} / kontent`;
    case "HYBRID":
      return `${formatPercent(campaign.commissionValue)} + ${formatMoneyMinor(campaign.fixedPaymentMinor ?? 0)}`;
  }
}

export function formatDeadline(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
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
