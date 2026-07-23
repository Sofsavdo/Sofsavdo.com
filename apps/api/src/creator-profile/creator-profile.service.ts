import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";

export interface CreatorProfileResponse {
  id: string;
  email: string;
  displayName: string;
  application: {
    id: string;
    status: string;
    currentStep: number;
    data: unknown;
    reviewNote: string | null;
    submittedAt: Date | null;
    reviewedAt: Date | null;
  };
}

// Deliberately separate from CreatorApplicationsService/module — this is a session-bootstrap read
// (auth infrastructure: "who is this creator, what's their onboarding status"), not onboarding or
// campaign-application *business logic*. It never mutates anything. See DECISIONS.md ADR-012.
@Injectable()
export class CreatorProfileService {
  constructor(private prisma: PrismaService) {}

  async getMine(creatorId: string): Promise<CreatorProfileResponse> {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorId },
      include: { user: true, applications: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!profile) throw new DomainException("NOT_FOUND", "Creator profili topilmadi.");

    const application = profile.applications[0];
    // Every creator gets a DRAFT application at registration (see AuthService.register) — its
    // absence here means a genuine data-integrity problem, not a normal new-account state, so
    // this is a typed error rather than a null the frontend would need to branch on forever.
    if (!application) throw new DomainException("NOT_FOUND", "Creator arizasi topilmadi.");

    return {
      id: profile.id,
      email: profile.user.email ?? "",
      displayName: profile.displayName,
      application: {
        id: application.id,
        status: application.status,
        currentStep: application.currentStep,
        data: application.formData,
        reviewNote: application.reviewNote,
        submittedAt: application.submittedAt,
        reviewedAt: application.reviewedAt,
      },
    };
  }
}
