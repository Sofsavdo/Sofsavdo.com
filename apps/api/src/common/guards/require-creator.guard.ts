import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { DomainException } from "../errors/domain-error";
import type { AuthenticatedUser } from "./jwt-auth.guard";

// Creator-facing routes are authorized by "does this JWT belong to a creator" (a CreatorProfile
// exists) AND "has that creator's onboarding application been approved" — not by the staff
// RolePermission table; the two authorization systems are deliberately kept apart (see RBAC.md).
// The approval check reads the existing (onboarding) CreatorApplication row directly — this guard
// does not implement any onboarding *business logic* (submit/review/etc.), only a read, so it
// stays auth infrastructure rather than drifting into that domain's concerns.
@Injectable()
export class RequireCreatorGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new DomainException("UNAUTHORIZED", "Autentifikatsiya talab qilinadi.");
    if (!user.creatorId) throw new DomainException("FORBIDDEN", "Bu endpoint faqat creatorlar uchun.");

    const application = await this.prisma.creatorApplication.findFirst({
      where: { creatorId: user.creatorId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    if (application?.status !== "APPROVED") {
      throw new DomainException("CREATOR_NOT_APPROVED", "Creator arizangiz hali tasdiqlanmagan.");
    }
    return true;
  }
}
