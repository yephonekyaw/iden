import { config } from "./config";
import type { Session } from "./sessions";

/**
 * Where a permission came from, asked of IDEN rather than of the door.
 *
 * This is the one call in the panel that is not about the building. A token
 * carries `scope` and nothing else — no roles, no groups — because a resource
 * server should not have to understand an organization's structure to check a
 * permission. But a *person* looking at a door they cannot open wants to know
 * why, and that question has an endpoint: `/entity/permissions` answers it with
 * the same provenance an administrator sees, from the same code, so the two can
 * never disagree.
 *
 * It needs `entity:permissions:read` in the token, which is why the panel asks
 * for it alongside the door scopes.
 */

export interface PermissionSource {
  value: string;
  viaDirect: boolean;
  viaRoles: string[];
  viaGroups: string[];
}

export interface Permissions {
  groups: string[];
  roles: string[];
  scopes: PermissionSource[];
}

export async function permissions(session: Session): Promise<Permissions | null> {
  const response = await fetch(`${config.issuer}/entity/permissions`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });

  // Not an error worth breaking the page over: the panel may simply not have
  // been granted this scope, and every door still works without it.
  if (!response.ok) return null;

  return (await response.json()) as Permissions;
}
