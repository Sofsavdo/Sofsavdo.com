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
];

const SUPER_ADMIN_PERMISSIONS: PermissionKey[] = [
  ...ADMIN_PERMISSIONS,
  "creator.block",
  "attribution.override",
  "settings.read",
  "settings.write",
  "user.read",
  "user.manage",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<"manager" | "admin" | "super_admin", PermissionKey[]> = {
  manager: MANAGER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  super_admin: SUPER_ADMIN_PERMISSIONS,
};
