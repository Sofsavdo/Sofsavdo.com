// The full permission-key surface from the Phase 6 spec §8. Backend enforces these on every
// admin/creator route via PermissionsGuard + @RequirePermissions(); the frontend's RoleGuard/
// hasRole() rank check (MANAGER < ADMIN < SUPER_ADMIN) only ever hides UI — it is not the real
// authorization boundary. See docs/SCHEMA_API_AUDIT.md "RBAC granularity" note.
export const PERMISSIONS = [
  "product.read",
  "product.write",
  "product.archive",
  "offer.read",
  "offer.write",
  "offer.publish",
  "offer.pause",
  "offer.archive",
  "landing.read",
  "landing.write",
  "landing.publish",
  "landing.archive",
  "campaign.read",
  "campaign.write",
  "campaign.publish",
  "campaign.pause",
  "campaign.complete",
  "campaign.archive",
  // Campaign-application review (a creator applying to join a Campaign) — named "application.*"
  // rather than the spec's suggested "creatorApplication.*" to keep the existing domain.action
  // lowercase-single-word convention this file enforces (see the spec test's regex); "revise" is
  // this convention's spelling of "request changes".
  "application.read",
  "application.review",
  "application.approve",
  "application.reject",
  "application.revise",
  "creator.read",
  "creator.review",
  "creator.suspend",
  "creator.block",
  "content.read",
  "content.review",
  // Content review decisions (Phase 7A) — mirrors the application.* 4-verb split
  // (review/approve/reject/revise) rather than folding everything into the pre-existing
  // "content.review": MANAGER can review, only ADMIN+ can decide, matching how application.review
  // vs application.approve/reject/revise are separated.
  "content.approve",
  "content.reject",
  "content.revise",
  // Creator-to-creator referral program (6B Enhancement) — distinct from the pre-existing
  // customer-facing ReferralLink/ReferralVisit concept, which has no admin actions yet.
  // "referral.read"/"referral.manage" already existed in this list (reserved, unused) and are
  // reused here: .read for the admin referral/rule listing, .manage for rule CRUD + activate/
  // deactivate. ".review" (reward approve/reject) and ".disqualify" are the two genuinely new
  // keys this domain needs. Campaign media and Offer delivery regions are sub-resources of an
  // existing admin-editable entity, so they reuse "campaign.write"/"offer.write" respectively
  // (same pattern as landing sections reusing "landing.write") rather than adding
  // "campaign.media.manage"/"delivery.manage", which would also violate this file's enforced
  // two-segment naming convention.
  "referral.read",
  "referral.manage",
  "referral.review",
  "referral.disqualify",
  "attribution.read",
  "attribution.override",
  "order.read",
  "order.update",
  "order.refund",
  "payment.read",
  "commission.read",
  "commission.adjust",
  "payout.read",
  "payout.approve",
  "payout.pay",
  "analytics.read",
  "analytics.export",
  "settings.read",
  "settings.write",
  "user.read",
  "user.manage",
  "audit.read",
  // Communication & Notification domain (Phase 10) — genuinely new keys, unlike Phase 8/9's
  // "zero new permissions" (nothing reserved these in the Phase 6 spec's original list).
  // ".read" covers the admin notification queue/failed-deliveries views; ".manage" covers retry
  // actions — same read/write split as every other two-verb domain in this file.
  "notification.read",
  "notification.manage",
  // Onboarding creator-application review (Phase 11) — the pre-existing "creator.*" keys
  // (read/review/suspend/block) are shaped for future admin *account* moderation (suspend/block
  // are UserStatus verbs), not application decisions, so reusing them here would leave that future
  // domain without its own review verb. "application.*" is already claimed by CampaignApplication
  // review (a creator applying to join a Campaign — see admin-applications.controller.ts). This is
  // a distinct domain: whether someone may be a creator on the platform at all. Read/review =
  // MANAGER, approve/reject/revise = ADMIN — same split as content.* (MANAGER can move a
  // submission into review, only ADMIN+ decides).
  "onboarding.read",
  "onboarding.review",
  "onboarding.approve",
  "onboarding.reject",
  "onboarding.revise",
  // Admin Operations domain (Phase 12) — the only two genuinely new keys this phase needs.
  // Everything else it touches already had a fitting key reserved: Users (user.read/user.manage),
  // Creators (creator.read/creator.review/creator.suspend/creator.block — "review" now means the
  // creator *account* detail view: stats/history/summaries, distinct from onboarding.review which
  // is the onboarding application queue), Payments (payment.read, read-only per this phase's own
  // spec), Settings (settings.read/settings.write), Audit (audit.read). Roles has no admin
  // permission key at all yet, and refund approve/reject is a genuinely new decision action
  // distinct from `order.refund` (which stays as-is, gating refund *creation* on the order detail
  // page — see DECISIONS.md ADR-019). Read/manage = same two-verb split as every other domain.
  "role.read",
  "role.manage",
  "refund.read",
  "refund.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

// Default role → permission grants. ADMIN inherits everything MANAGER has, SUPER_ADMIN
// inherits everything ADMIN has, plus the handful of actions the spec restricts to super-admin
// only (roles/settings/manual attribution override/user management).
const MANAGER_PERMISSIONS: PermissionKey[] = [
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
];

const ADMIN_PERMISSIONS: PermissionKey[] = [
  ...MANAGER_PERMISSIONS,
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
];

const SUPER_ADMIN_PERMISSIONS: PermissionKey[] = [
  ...ADMIN_PERMISSIONS,
  "creator.block",
  "attribution.override",
  "settings.read",
  "settings.write",
  "user.read",
  "user.manage",
  "role.read",
  "role.manage",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<"manager" | "admin" | "super_admin", PermissionKey[]> = {
  manager: MANAGER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  super_admin: SUPER_ADMIN_PERMISSIONS,
};
