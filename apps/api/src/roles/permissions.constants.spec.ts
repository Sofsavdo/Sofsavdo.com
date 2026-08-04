import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "./permissions.constants";

// Pure, no-DB matrix test — the real-database counterpart (seeded roles actually carrying these
// grants in Postgres) is apps/api/test/rbac.e2e-spec.ts. This test exists so a future edit to
// permissions.constants.ts that silently drops or duplicates a grant fails immediately, without
// needing a database to catch it. RBAC.md's tables must match this file exactly.
describe("permission matrix", () => {
  it("has exactly 78 permission keys, each domain.action shaped", () => {
    expect(PERMISSIONS).toHaveLength(78);
    for (const key of PERMISSIONS) {
      // domain segment allows snake_case (e.g. "launch_bonus") for multi-word domains.
      expect(key).toMatch(/^[a-z][a-z_]*\.[a-z]+$/);
    }
  });

  it("has no duplicate permission keys", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("MANAGER has read/review access but no write/publish/approve/pay/settings/user powers", () => {
    const manager = DEFAULT_ROLE_PERMISSIONS.manager;
    expect(manager).toEqual(
      expect.arrayContaining([
        "product.read",
        "offer.read",
        "landing.read",
        "campaign.read",
        "application.read",
        "creator.read",
        "creator.review",
        "content.read",
        "content.review",
        "referral.read",
        "attribution.read",
        "order.read",
        "order.update",
        "payment.read",
        "commission.read",
        "payout.read",
        "analytics.read",
        "audit.read",
        "notification.read",
        "onboarding.read",
        "onboarding.review",
        "refund.read",
        "homepage.read",
        "competition.read",
      ]),
    );
    for (const forbidden of [
      "product.write",
      "offer.publish",
      "offer.pause",
      "offer.archive",
      "landing.write",
      "landing.publish",
      "landing.archive",
      "campaign.publish",
      "campaign.pause",
      "campaign.complete",
      "campaign.archive",
      "application.review",
      "application.approve",
      "application.reject",
      "application.revise",
      "creator.suspend",
      "creator.block",
      "content.approve",
      "content.reject",
      "content.revise",
      "referral.manage",
      "referral.review",
      "referral.disqualify",
      "order.refund",
      "commission.adjust",
      "payout.approve",
      "payout.pay",
      "settings.write",
      "user.manage",
      "attribution.override",
      "notification.manage",
      "onboarding.approve",
      "onboarding.reject",
      "onboarding.revise",
      "refund.manage",
      "role.read",
      "role.manage",
    ]) {
      expect(manager).not.toContain(forbidden);
    }
  });

  it("ADMIN is a strict superset of MANAGER, plus write/publish/approve powers", () => {
    const manager = DEFAULT_ROLE_PERMISSIONS.manager;
    const admin = DEFAULT_ROLE_PERMISSIONS.admin;
    for (const perm of manager) expect(admin).toContain(perm);

    for (const granted of [
      "product.write",
      "product.archive",
      "offer.write",
      "offer.publish",
      "offer.pause",
      "offer.archive",
      "landing.write",
      "landing.publish",
      "landing.archive",
      "campaign.write",
      "campaign.publish",
      "campaign.pause",
      "campaign.complete",
      "campaign.archive",
      "application.review",
      "application.approve",
      "application.reject",
      "application.revise",
      "creator.suspend",
      "content.approve",
      "content.reject",
      "content.revise",
      "referral.manage",
      "referral.review",
      "referral.disqualify",
      "order.refund",
      "commission.adjust",
      "payout.approve",
      "payout.pay",
      "analytics.export",
      "notification.manage",
      "onboarding.approve",
      "onboarding.reject",
      "onboarding.revise",
      "refund.manage",
      "homepage.write",
      "competition.write",
      "competition.publish",
      "competition.complete",
      "competition.archive",
    ]) {
      expect(admin).toContain(granted);
    }
    for (const forbidden of ["creator.block", "attribution.override", "settings.write", "user.manage", "role.read", "role.manage"]) {
      expect(admin).not.toContain(forbidden);
    }
  });

  it("SUPER_ADMIN is a strict superset of ADMIN, plus the super-admin-only powers", () => {
    const admin = DEFAULT_ROLE_PERMISSIONS.admin;
    const superAdmin = DEFAULT_ROLE_PERMISSIONS.super_admin;
    for (const perm of admin) expect(superAdmin).toContain(perm);

    for (const granted of [
      "creator.block",
      "attribution.override",
      "settings.read",
      "settings.write",
      "user.read",
      "user.manage",
      "role.read",
      "role.manage",
    ]) {
      expect(superAdmin).toContain(granted);
    }
  });

  it("SUPER_ADMIN holds every permission that exists", () => {
    const superAdmin = new Set(DEFAULT_ROLE_PERMISSIONS.super_admin);
    for (const key of PERMISSIONS) {
      expect(superAdmin.has(key)).toBe(true);
    }
  });
});
