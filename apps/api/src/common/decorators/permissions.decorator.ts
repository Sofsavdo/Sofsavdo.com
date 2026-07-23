import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "../../roles/permissions.constants";

export const PERMISSIONS_KEY = "permissions";

// Every permission listed must be present on the caller's aggregated role permissions —
// PermissionsGuard ANDs them, never ORs, so a route needing two permissions can't be satisfied
// by having just one.
export const RequirePermissions = (...permissions: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, permissions);
