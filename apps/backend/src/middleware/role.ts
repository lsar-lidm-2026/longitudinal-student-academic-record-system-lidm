import { ForbiddenError } from "../common/error";

/**
 * Check if the user has one of the allowed roles.
 * This should be called inside route handlers that already have requireAuth.
 */
export function checkRole(user: { role: string } | undefined, ...roles: string[]) {
  if (!user || !roles.includes(user.role)) {
    throw new ForbiddenError(`Requires one of roles: ${roles.join(", ")}`);
  }
}
