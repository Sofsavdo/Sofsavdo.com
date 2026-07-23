import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateOfferDto } from "./create-offer.dto";

// `status` is deliberately not a field anywhere in this class hierarchy — status transitions are
// exclusively through /activate, /pause, /archive (see OffersController), never a generic PATCH.
// productId is also excluded: moving an existing Offer to a different Product is a bigger
// operation than "update a field" (it would orphan/relink Landing, Campaign, referral links, etc.
// — no part of this domain's spec asked for it, and allowing it silently would let an offer's
// commercial history point at the wrong product retroactively).
export class UpdateOfferDto extends PartialType(OmitType(CreateOfferDto, ["productId"] as const)) {}
