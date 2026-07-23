import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class QuoteDto {
  @ApiPropertyOptional({ description: "Required for PHYSICAL_PRODUCT offers; ignored otherwise." })
  @IsOptional()
  @IsString()
  regionCode?: string;
}
