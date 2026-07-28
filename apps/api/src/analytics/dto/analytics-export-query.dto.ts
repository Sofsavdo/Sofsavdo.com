import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { AnalyticsQueryDto } from "./analytics-query.dto";

const EXPORTABLE_VIEWS = ["executive", "creators", "campaigns", "products", "payments", "refunds", "customers"] as const;
export type AnalyticsExportView = (typeof EXPORTABLE_VIEWS)[number];

// Excel/PDF are deliberately not in this list yet — Phase 13 v1 scope is CSV only (approved
// decision). Widening this to ["csv", "xlsx", "pdf"] plus a branch in AnalyticsExportService is
// the only change needed to add them later; see ANALYTICS.md §15 and DECISIONS.md ADR-020.
const EXPORT_FORMATS = ["csv"] as const;

export class AnalyticsExportQueryDto extends AnalyticsQueryDto {
  @ApiProperty({ enum: EXPORTABLE_VIEWS })
  @IsIn(EXPORTABLE_VIEWS)
  view!: AnalyticsExportView;

  @ApiPropertyOptional({ enum: EXPORT_FORMATS, default: "csv" })
  @IsIn(EXPORT_FORMATS)
  format: (typeof EXPORT_FORMATS)[number] = "csv";
}
