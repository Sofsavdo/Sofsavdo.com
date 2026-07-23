import { PartialType } from "@nestjs/swagger";
import { CreateReferralRuleDto } from "./create-referral-rule.dto";

export class UpdateReferralRuleDto extends PartialType(CreateReferralRuleDto) {}
