import { classifyCreatorActivity, type CreatorActivityInput } from "./creator-activity";

const NOW = new Date("2026-08-07T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function base(over: Partial<CreatorActivityInput> = {}): CreatorActivityInput {
  return {
    now: NOW,
    registeredAt: daysAgo(1),
    flowCount: 0,
    totalClicks: 0,
    totalOrders: 0,
    totalEarnedMinor: 0,
    ...over,
  };
}

describe("classifyCreatorActivity", () => {
  it("classifies a just-registered creator with no flow (within grace) as NEW", () => {
    expect(classifyCreatorActivity(base({ registeredAt: daysAgo(1) }))).toBe("NEW");
  });

  it("classifies a creator past the grace window with still no flow as NO_FLOW", () => {
    expect(classifyCreatorActivity(base({ registeredAt: daysAgo(10) }))).toBe("NO_FLOW");
  });

  it("treats exactly the grace boundary as still NEW", () => {
    expect(classifyCreatorActivity(base({ registeredAt: daysAgo(3) }))).toBe("NEW");
  });

  it("classifies a creator with a flow but zero clicks as FLOW_NO_CLICKS", () => {
    expect(classifyCreatorActivity(base({ registeredAt: daysAgo(10), flowCount: 1, totalClicks: 0 }))).toBe("FLOW_NO_CLICKS");
  });

  it("classifies a creator with clicks but no earnings as ACTIVE_NO_EARNINGS", () => {
    expect(classifyCreatorActivity(base({ flowCount: 1, totalClicks: 12 }))).toBe("ACTIVE_NO_EARNINGS");
  });

  it("classifies a creator with orders as EARNING", () => {
    expect(classifyCreatorActivity(base({ flowCount: 1, totalClicks: 12, totalOrders: 2 }))).toBe("EARNING");
  });

  it("classifies a creator with accrued commission but zero recorded orders as EARNING", () => {
    expect(classifyCreatorActivity(base({ flowCount: 1, totalClicks: 5, totalOrders: 0, totalEarnedMinor: 29900_00 }))).toBe("EARNING");
  });

  it("earning takes precedence even if clicks somehow read zero", () => {
    expect(classifyCreatorActivity(base({ flowCount: 1, totalClicks: 0, totalEarnedMinor: 1000 }))).toBe("EARNING");
  });
});
