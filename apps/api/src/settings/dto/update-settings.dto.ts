import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject } from "class-validator";

// Keys/value-types are validated against SETTINGS_CATALOG inside SettingsService, not here —
// class-validator can't express "one of ~15 known keys, each with its own value type" cleanly,
// and the catalog is the single source of truth for that shape already (same passthrough-then-
// validate-in-service pattern as onboarding's UpdateOnboardingDto.formData).
export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: "Partial map of setting key -> new value, e.g. { \"general.platformName\": \"Rosti\" }" })
  @IsObject()
  values!: Record<string, unknown>;
}
