import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { BioComplianceStatus } from "@prisma/client";

export class SetBioComplianceDto {
  @ApiProperty({ enum: BioComplianceStatus })
  @IsEnum(BioComplianceStatus)
  status!: BioComplianceStatus;
}
