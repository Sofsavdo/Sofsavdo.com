import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationsService } from "./notifications.service";
import {
  NOTIFICATION_EVENTS,
  type CampaignApplicationApprovedEvent,
  type CampaignApplicationRejectedEvent,
  type CampaignApplicationSubmittedEvent,
  type OnboardingApprovedEvent,
  type OnboardingChangesRequestedEvent,
  type OnboardingRejectedEvent,
  type OnboardingSubmittedEvent,
  type PasswordResetRequestedEvent,
  type UserRegisteredEvent,
} from "./events";

// The one place a real, direct EventEmitter2 emission (from a domain this phase is free to edit —
// CreatorApplicationsService, AuthService) becomes a Notification. Keeping all of "what does event
// X mean for notifications" here, rather than inline at each emit call site, is what lets a new
// event type be added without touching the emitting service a second time. See DECISIONS.md
// ADR-017 for why NotificationSweepService (the Phase 8/9 half of this domain) does NOT also route
// through here — it calls NotificationsService directly instead.
@Injectable()
export class NotificationEventsListener {
  constructor(private notifications: NotificationsService) {}

  @OnEvent(NOTIFICATION_EVENTS.CAMPAIGN_APPLICATION_SUBMITTED)
  async onCampaignApplicationSubmitted(event: CampaignApplicationSubmittedEvent): Promise<void> {
    await this.notifications.dispatchToCreator(
      event.creatorId,
      "campaign_application.submitted",
      { creatorName: event.creatorName, campaignName: event.campaignName },
      `campaign_application.submitted:${event.applicationId}`,
    );
    await this.notifications.dispatchToAdmins(
      "campaign_application.new",
      { creatorName: event.creatorName, campaignName: event.campaignName, applicationId: event.applicationId },
      `campaign_application.new:${event.applicationId}`,
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.CAMPAIGN_APPLICATION_APPROVED)
  async onCampaignApplicationApproved(event: CampaignApplicationApprovedEvent): Promise<void> {
    const vars = { creatorName: event.creatorName, campaignName: event.campaignName };
    await this.notifications.dispatchToCreator(event.creatorId, "campaign_application.approved", vars, `campaign_application.approved:${event.applicationId}`);
    await this.notifications.dispatchToCreator(event.creatorId, "campaign.joined", vars, `campaign.joined:${event.applicationId}`);
  }

  @OnEvent(NOTIFICATION_EVENTS.CAMPAIGN_APPLICATION_REJECTED)
  async onCampaignApplicationRejected(event: CampaignApplicationRejectedEvent): Promise<void> {
    await this.notifications.dispatchToCreator(
      event.creatorId,
      "campaign_application.rejected",
      { creatorName: event.creatorName, campaignName: event.campaignName, reason: event.reason },
      `campaign_application.rejected:${event.applicationId}`,
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.ONBOARDING_SUBMITTED)
  async onOnboardingSubmitted(event: OnboardingSubmittedEvent): Promise<void> {
    await this.notifications.dispatchToCreator(
      event.creatorId,
      "onboarding.submitted",
      { creatorName: event.creatorName },
      `onboarding.submitted:${event.applicationId}`,
    );
    await this.notifications.dispatchToAdmins(
      "onboarding.new",
      { creatorName: event.creatorName, applicationId: event.applicationId },
      `onboarding.new:${event.applicationId}`,
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.ONBOARDING_APPROVED)
  async onOnboardingApproved(event: OnboardingApprovedEvent): Promise<void> {
    await this.notifications.dispatchToCreator(
      event.creatorId,
      "onboarding.approved",
      { creatorName: event.creatorName },
      `onboarding.approved:${event.applicationId}`,
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.ONBOARDING_REJECTED)
  async onOnboardingRejected(event: OnboardingRejectedEvent): Promise<void> {
    await this.notifications.dispatchToCreator(
      event.creatorId,
      "onboarding.rejected",
      { creatorName: event.creatorName, reason: event.reason },
      `onboarding.rejected:${event.applicationId}`,
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.ONBOARDING_CHANGES_REQUESTED)
  async onOnboardingChangesRequested(event: OnboardingChangesRequestedEvent): Promise<void> {
    await this.notifications.dispatchToCreator(
      event.creatorId,
      "onboarding.changes_requested",
      { creatorName: event.creatorName, reason: event.reason },
      `onboarding.changes_requested:${event.applicationId}`,
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.USER_REGISTERED)
  async onUserRegistered(event: UserRegisteredEvent): Promise<void> {
    await this.notifications.dispatchToUser(event.userId, "user.registered", { displayName: event.displayName });
  }

  @OnEvent(NOTIFICATION_EVENTS.PASSWORD_RESET_REQUESTED)
  async onPasswordResetRequested(event: PasswordResetRequestedEvent): Promise<void> {
    await this.notifications.dispatchPasswordReset(event.userId, event.resetUrl);
  }
}
