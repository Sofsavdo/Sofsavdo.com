import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { PermissionKey } from "../../roles/permissions.constants";
import { DomainException } from "../errors/domain-error";
import type { AuthenticatedUser } from "./jwt-auth.guard";

// Runs after JwtAuthGuard. A route with no @RequirePermissions() and no @Public() only requires
// "is logged in" (JwtAuthGuard already enforced that) — this guard is a no-op in that case.
// A route WITH @RequirePermissions() requires every listed key to be in the caller's aggregated
// role permissions, checked server-side regardless of what the frontend chose to show/hide.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new DomainException("UNAUTHORIZED", "Autentifikatsiya talab qilinadi.");

    const hasAll = required.every((perm) => user.permissions.includes(perm));
    if (!hasAll) {
      throw new DomainException("FORBIDDEN", "Bu amal uchun yetarli ruxsatingiz yo'q.", {
        required,
      });
    }
    return true;
  }
}
