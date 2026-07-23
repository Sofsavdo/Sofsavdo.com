import { classifyActivity, type ActivityInput } from "./activity-classification";

const NOW = new Date("2026-07-22T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function base(overrides: Partial<ActivityInput> = {}): ActivityInput {
  return {
    now: NOW,
    registeredAt: daysAgo(1),
    onboardingStatus: "DRAFT",
    onboardingSubmittedAt: null,
    onboardingUpdatedAt: daysAgo(1),
    hasAnyCampaignApplication: false,
    hasApprovedCampaignApplication: false,
    hasQualifiedEarnings: false,
    lastMeaningfulActivityAt: daysAgo(1),
    ...overrides,
  };
}

describe("classifyActivity", () => {
  it("classifies a just-registered creator (draft, unsubmitted, within 3 days) as NEW", () => {
    expect(classifyActivity(base())).toBe("NEW");
  });

  it("classifies a submitted-but-not-yet-reviewed onboarding as AWAITING_APPROVAL", () => {
    expect(classifyActivity(base({ onboardingStatus: "UNDER_REVIEW", onboardingSubmittedAt: daysAgo(1) }))).toBe("AWAITING_APPROVAL");
  });

  it("classifies a draft/submitted onboarding stuck past 3 days as ONBOARDING_STALLED", () => {
    expect(
      classifyActivity(
        base({
          onboardingStatus: "SUBMITTED",
          onboardingSubmittedAt: daysAgo(4),
          registeredAt: daysAgo(5),
          lastMeaningfulActivityAt: daysAgo(4),
        }),
      ),
    ).toBe("ONBOARDING_STALLED");
  });

  it("classifies REJECTED onboarding as DORMANT regardless of recency", () => {
    expect(classifyActivity(base({ onboardingStatus: "REJECTED", registeredAt: NOW, lastMeaningfulActivityAt: NOW }))).toBe("DORMANT");
  });

  it("classifies an approved creator with no campaign application within 7 days as APPROVED_INACTIVE", () => {
    expect(
      classifyActivity(
        base({
          onboardingStatus: "APPROVED",
          onboardingUpdatedAt: daysAgo(8),
          registeredAt: daysAgo(10),
          lastMeaningfulActivityAt: daysAgo(8),
        }),
      ),
    ).toBe("APPROVED_INACTIVE");
  });

  it("classifies an approved creator with a campaign application as ACTIVE_NO_EARNINGS", () => {
    expect(
      classifyActivity(
        base({
          onboardingStatus: "APPROVED",
          hasAnyCampaignApplication: true,
          lastMeaningfulActivityAt: daysAgo(1),
        }),
      ),
    ).toBe("ACTIVE_NO_EARNINGS");
  });

  it("classifies an approved creator with qualified earnings as EARNING, even if otherwise inactive-looking", () => {
    expect(
      classifyActivity(
        base({
          onboardingStatus: "APPROVED",
          hasQualifiedEarnings: true,
          lastMeaningfulActivityAt: daysAgo(20),
        }),
      ),
    ).toBe("EARNING");
  });

  it("classifies any status with no meaningful activity for more than 14 days as DORMANT", () => {
    expect(
      classifyActivity(
        base({
          onboardingStatus: "APPROVED",
          hasAnyCampaignApplication: true,
          lastMeaningfulActivityAt: daysAgo(15),
        }),
      ),
    ).toBe("DORMANT");
  });

  it("never classifies registration alone (day 0, DRAFT, no submission) as anything but NEW — registration is not a milestone", () => {
    expect(classifyActivity(base({ registeredAt: NOW, onboardingUpdatedAt: NOW, lastMeaningfulActivityAt: NOW }))).toBe("NEW");
  });
});
