import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { IS_OPTIONAL_AUTH_KEY } from "../decorators/optional-auth.decorator";
import type { PermissionKey } from "../../roles/permissions.constants";

export interface AuthenticatedUser {
  userId: string;
  email: string | null;
  phone: string | null;
  roleKeys: string[];
  permissions: PermissionKey[];
  creatorId: string | null;
}

// Global guard (registered as APP_GUARD in app.module.ts) — every route requires a valid access
// JWT unless explicitly marked @Public(). This is deliberately fail-closed: a new controller that
// forgets to think about auth is protected by default, not open by default.
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  // Overridden only to support @OptionalAuth() (see that decorator's comment) — every other route
  // keeps the default passport behavior below (reject on missing/invalid token) unchanged.
  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser | false, info: unknown, context: ExecutionContext): TUser {
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOptionalAuth) return (user || undefined) as TUser;
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException();
    return user;
  }
}
