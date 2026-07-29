import { PartialType } from "@nestjs/swagger";
import { CreateCompetitionDto } from "./create-competition.dto";

// No `status` field — same convention as UpdateLandingDto/UpdateOfferDto: status only moves via
// the explicit publish/complete/archive transition endpoints below.
export class UpdateCompetitionDto extends PartialType(CreateCompetitionDto) {}
