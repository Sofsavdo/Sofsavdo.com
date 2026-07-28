import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

// Shared by suspend/block — both require a meaningful reason, same convention as every other
// review-reason DTO in this codebase; unsuspend/unblock take no body (single-click reversal,
// matching the pre-existing mock UI's own asymmetric suspend-needs-reason/reactivate-is-one-click
// pattern — see apps/web/app/admin/(app)/creators/[id]/page.tsx).
export class AccountActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
