import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsObject, IsOptional, Max, Min } from "class-validator";

// The onboarding wizard is a fixed 8-step form (see apps/web's OnboardingWizard.tsx), but its
// exact field shape lives entirely on the frontend — same "structured, creator-authored passthrough
// Json bag" convention as CampaignApplication.answers (see CreateApplicationDto) and
// Content.metadata. The backend only needs to persist and return it, never validate its internal
// shape; `currentStep` is the one field this domain's own transition logic cares about.
export class UpdateOnboardingDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  currentStep?: number;

  @ApiPropertyOptional({ description: "Full current wizard form state — replaces the stored formData." })
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}
