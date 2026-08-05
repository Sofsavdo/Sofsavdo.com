// Event payload contracts shared between the emitting service and NotificationEventsListener —
// see DECISIONS.md ADR-017. Domains this phase is free to edit (CreatorApplicationsService,
// AuthService) emit these directly via EventEmitter2; NotificationSweepService synthesizes the
// equivalent Order/Payment/Commission/Payout events without needing a shared type here, since it
// calls NotificationsService directly rather than through the event bus (see that file's own
// comment for why).

export const NOTIFICATION_EVENTS = {
  CAMPAIGN_APPLICATION_SUBMITTED: "campaign_application.submitted",
  CAMPAIGN_APPLICATION_APPROVED: "campaign_application.approved",
  CAMPAIGN_APPLICATION_REJECTED: "campaign_application.rejected",
  USER_REGISTERED: "user.registered",
  PASSWORD_RESET_REQUESTED: "password_reset.requested",
  // Onboarding CreatorApplication lifecycle (Phase 11) — distinct from CAMPAIGN_APPLICATION_*
  // above, which is CampaignApplication (a creator applying to join a Campaign, see ADR-012); this
  // is the onboarding admission decision (may this person be a creator on the platform at all).
  ONBOARDING_SUBMITTED: "onboarding.submitted",
  ONBOARDING_APPROVED: "onboarding.approved",
  ONBOARDING_REJECTED: "onboarding.rejected",
  ONBOARDING_CHANGES_REQUESTED: "onboarding.changes_requested",
  // Launch Bonus System events
  BONUS_UNLOCKED: "bonus.unlocked",
  BONUS_EXPIRED: "bonus.expired",
  // Video-submission Competition entries (metric === "INSTAGRAM_VIEWS") — distinct from
  // CAMPAIGN_APPLICATION_* above, which is a different domain entirely (CampaignApplication).
  COMPETITION_SUBMISSION_NEW: "competition_submission.new",
  COMPETITION_SUBMISSION_APPROVED: "competition_submission.approved",
  COMPETITION_SUBMISSION_REJECTED: "competition_submission.rejected",
} as const;

export interface CampaignApplicationSubmittedEvent {
  applicationId: string;
  creatorId: string;
  creatorName: string;
  campaignName: string;
}

export interface CampaignApplicationApprovedEvent {
  applicationId: string;
  creatorId: string;
  creatorName: string;
  campaignName: string;
}

export interface CampaignApplicationRejectedEvent {
  applicationId: string;
  creatorId: string;
  creatorName: string;
  campaignName: string;
  reason: string;
}

export interface UserRegisteredEvent {
  userId: string;
  displayName: string;
}

export interface PasswordResetRequestedEvent {
  userId: string;
  resetUrl: string;
}

export interface OnboardingSubmittedEvent {
  applicationId: string;
  creatorId: string;
  creatorName: string;
}

export interface OnboardingApprovedEvent {
  applicationId: string;
  creatorId: string;
  creatorName: string;
}

export interface OnboardingRejectedEvent {
  applicationId: string;
  creatorId: string;
  creatorName: string;
  reason: string;
}

export interface OnboardingChangesRequestedEvent {
  applicationId: string;
  creatorId: string;
  creatorName: string;
  reason: string;
}

export interface BonusUnlockedEvent {
  creatorProfileId: string;
  bonusAmountMinor: number;
}

export interface BonusExpiredEvent {
  creatorProfileId: string;
}

export interface CompetitionSubmissionNewEvent {
  participantId: string;
  competitionId: string;
  competitionName: string;
  creatorId: string;
  creatorName: string;
}

export interface CompetitionSubmissionApprovedEvent {
  competitionId: string;
  competitionName: string;
  creatorId: string;
}

export interface CompetitionSubmissionRejectedEvent {
  competitionId: string;
  competitionName: string;
  creatorId: string;
  reason: string;
  // ISO timestamp of this specific reject decision (CompetitionParticipant.reviewedAt) — used in
  // the dedup key instead of participantId alone, since a rejected participant resubmits into the
  // *same* row (the competitionId+creatorId unique constraint forbids a second row). Keying only
  // on participantId would silently swallow the notification for a second rejection after
  // resubmission; keying on the decision's own timestamp lets a genuine retry of the same decision
  // dedupe while a later, different decision does not.
  decidedAt: string;
}
