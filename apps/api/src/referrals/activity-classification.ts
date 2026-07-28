// Centrally defined creator-activity classification (6B Enhancement referral program). Thresholds
// documented here are the single source of truth — see DECISIONS.md ADR-013 and PROJECT_STATUS.md
// for the same numbers restated for humans. Nothing here is configurable via the database yet
// (no admin UI need was specified beyond "document the thresholds"); if that changes, these
// become Setting rows instead of constants.
export const ONBOARDING_STALLED_AFTER_DAYS = 3;
export const APPROVED_INACTIVE_AFTER_DAYS = 7;
export const DORMANT_AFTER_DAYS = 14;

export const ACTIVITY_CLASSES = [
  "NEW",
  "ONBOARDING_STALLED",
  "AWAITING_APPROVAL",
  "APPROVED_INACTIVE",
  "ACTIVE_NO_EARNINGS",
  "EARNING",
  "DORMANT",
] as const;
export type ActivityClass = (typeof ACTIVITY_CLASSES)[number];

export interface ActivityInput {
  now: Date;
  registeredAt: Date;
  onboardingStatus: string; // CreatorApplicationStatus — read live, not denormalized (see referrals.service.ts)
  onboardingSubmittedAt: Date | null;
  onboardingUpdatedAt: Date;
  hasAnyCampaignApplication: boolean;
  hasApprovedCampaignApplication: boolean;
  hasQualifiedEarnings: boolean; // always false today — no Order/Commission domain yet
  lastMeaningfulActivityAt: Date;
}

function daysSince(now: Date, then: Date): number {
  return (now.getTime() - then.getTime()) / 86_400_000;
}

// Pure function — no DB access — so it's directly unit-testable against fixed clocks, and so
// ReferralsService stays a thin real-data-gathering wrapper around this decision table.
export function classifyActivity(input: ActivityInput): ActivityClass {
  const {
    now,
    registeredAt,
    onboardingStatus,
    onboardingSubmittedAt,
    onboardingUpdatedAt,
    hasAnyCampaignApplication,
    hasApprovedCampaignApplication,
    hasQualifiedEarnings,
    lastMeaningfulActivityAt,
  } = input;

  if (onboardingStatus === "REJECTED") return "DORMANT";

  if (onboardingStatus === "APPROVED") {
    if (hasQualifiedEarnings) return "EARNING";
    if (daysSince(now, lastMeaningfulActivityAt) > DORMANT_AFTER_DAYS) return "DORMANT";
    if (hasAnyCampaignApplication || hasApprovedCampaignApplication) return "ACTIVE_NO_EARNINGS";
    if (daysSince(now, onboardingUpdatedAt) > APPROVED_INACTIVE_AFTER_DAYS) return "APPROVED_INACTIVE";
    return "APPROVED_INACTIVE";
  }

  // DRAFT / SUBMITTED / UNDER_REVIEW / CHANGES_REQUESTED
  if (daysSince(now, lastMeaningfulActivityAt) > DORMANT_AFTER_DAYS) return "DORMANT";
  if (onboardingStatus === "UNDER_REVIEW") return "AWAITING_APPROVAL";
  if (onboardingSubmittedAt == null && daysSince(now, registeredAt) <= ONBOARDING_STALLED_AFTER_DAYS) return "NEW";
  if (daysSince(now, onboardingSubmittedAt ?? registeredAt) > ONBOARDING_STALLED_AFTER_DAYS) return "ONBOARDING_STALLED";
  return "NEW";
}
