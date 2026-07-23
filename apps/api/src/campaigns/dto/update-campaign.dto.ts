import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateCampaignDto } from "./create-campaign.dto";

// Deliberately no `status` anywhere in this hierarchy and offerId is immutable once created —
// same pattern as Offer/Landing. Status only ever moves through the dedicated transition
// endpoints, which check the transition matrix.
export class UpdateCampaignDto extends PartialType(OmitType(CreateCampaignDto, ["offerId"] as const)) {}
