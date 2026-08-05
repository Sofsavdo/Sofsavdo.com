import * as t from "./registry";
export type { NotificationTemplate, RenderedEmail } from "./registry";

// One registry, keyed by the exact string stored in Notification.type — every notification this
// domain ever creates goes through one of these. Adding a new business event means adding one key
// here (plus the emit/sweep site), never touching any existing template.
export const TEMPLATES = {
  "campaign_application.submitted": t.campaignApplicationSubmitted,
  "campaign_application.approved": t.campaignApplicationApproved,
  "campaign_application.rejected": t.campaignApplicationRejected,
  "campaign.joined": t.campaignJoined,
  "campaign_application.new": t.campaignApplicationNewAdmin,
  "order.received": t.orderReceived,
  "order.delivered": t.orderDelivered,
  "commission.approved": t.commissionApproved,
  "commission.payable": t.commissionPayable,
  "payout.requested": t.payoutRequested,
  "payout.approved": t.payoutApproved,
  "payout.rejected": t.payoutRejected,
  "payout.paid": t.payoutPaid,
  "payout.requested.admin": t.payoutRequestedAdmin,
  "payout.failed.admin": t.payoutFailedAdmin,
  "payment.failed.admin": t.paymentFailedAdmin,
  "user.registered": t.userRegisteredWelcome,
  "password_reset.requested": t.passwordResetRequested,
  "onboarding.submitted": t.onboardingSubmitted,
  "onboarding.approved": t.onboardingApproved,
  "onboarding.rejected": t.onboardingRejected,
  "onboarding.changes_requested": t.onboardingChangesRequested,
  "onboarding.new": t.onboardingNewAdmin,
  "competition_submission.new": t.competitionSubmissionNewAdmin,
  "competition_submission.approved": t.competitionSubmissionApproved,
  "competition_submission.rejected": t.competitionSubmissionRejected,
} as const;

export type NotificationTypeKey = keyof typeof TEMPLATES;
