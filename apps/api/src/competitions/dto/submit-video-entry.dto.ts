import { ApiProperty } from "@nestjs/swagger";
import { IsUrl, MaxLength } from "class-validator";

export class SubmitVideoEntryDto {
  @ApiProperty({ description: "Instagram videoning (reels) to'liq havolasi." })
  @IsUrl({}, { message: "videoUrl to'g'ri havola (URL) bo'lishi kerak." })
  @MaxLength(2000)
  videoUrl!: string;
}
