import { PartialType } from "@nestjs/swagger";
import { CreateLandingDto } from "./create-landing.dto";

// Deliberately no `status` field anywhere in this hierarchy — same as Offer's UpdateOfferDto,
// status only ever moves through the dedicated publish/unpublish/archive endpoints, which check
// the transition matrix. A generic PATCH must never be able to set it directly.
export class UpdateLandingDto extends PartialType(CreateLandingDto) {}
