import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

// Admin-entered — see CompetitionParticipant.viewCountSource's schema comment for why this isn't
// fetched live from Instagram.
export class UpdateViewCountDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  viewCount!: number;
}
