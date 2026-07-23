import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class UpdateOrderNotesDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  notes!: string;
}
