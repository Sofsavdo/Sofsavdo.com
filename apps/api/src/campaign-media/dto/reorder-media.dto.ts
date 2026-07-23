import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString } from "class-validator";

// Same pattern as landings' reorder-sections.dto.ts — a full ordered id list, ordinal position
// implied by array index. Deterministic, no partial reordering ambiguity.
export class ReorderMediaDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
