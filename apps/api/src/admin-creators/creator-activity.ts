// Flow-centric creator activity classification for the admin creators list. Deliberately does NOT
// consider onboarding/application status: creator applications auto-approve on submit (see
// onboarding.service.ts), so an application-review funnel would be noise here — the only meaningful
// progression is whether a creator has picked a product to promote (taken a Flow) and whether that
// Flow is generating clicks and earnings. Pure function (no DB) so it's directly unit-testable.

// A just-registered creator without a Flow isn't "stalled" yet — give them a grace window before
// flagging them for outreach. Changeable in one place if the operator wants a tighter/looser cadence.
export const NEW_GRACE_DAYS = 3;

export const CREATOR_ACTIVITY_STATUSES = [
  "NEW", // registered within the grace window, no Flow yet — leave alone
  "NO_FLOW", // past the grace window, still hasn't taken any Flow — the core "registered then stopped" group
  "FLOW_NO_CLICKS", // took a Flow but its link has never been clicked — has the link, isn't sharing it
  "ACTIVE_NO_EARNINGS", // link is getting clicks but no orders/commission yet
  "EARNING", // has real orders or commission
] as const;
export type CreatorActivityStatus = (typeof CREATOR_ACTIVITY_STATUSES)[number];

export interface CreatorActivityInput {
  now: Date;
  registeredAt: Date;
  flowCount: number;
  totalClicks: number;
  totalOrders: number;
  totalEarnedMinor: number;
}

function daysSince(now: Date, then: Date): number {
  return (now.getTime() - then.getTime()) / 86_400_000;
}

export function classifyCreatorActivity(input: CreatorActivityInput): CreatorActivityStatus {
  const { now, registeredAt, flowCount, totalClicks, totalOrders, totalEarnedMinor } = input;

  if (totalOrders > 0 || totalEarnedMinor > 0) return "EARNING";
  if (flowCount > 0 && totalClicks > 0) return "ACTIVE_NO_EARNINGS";
  if (flowCount > 0) return "FLOW_NO_CLICKS";
  // No Flow yet.
  if (daysSince(now, registeredAt) <= NEW_GRACE_DAYS) return "NEW";
  return "NO_FLOW";
}
