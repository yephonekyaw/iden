import { ADMIN_SESSION_USER, SCOPES } from "@/lib/mock-data";
import type { Role, Session } from "@/lib/types";

export function getSessionFor(role: Role): Session {
  const scopes = SCOPES.filter((s) => s.allowed_roles.includes(role)).map((s) => s.name);
  return {
    user: {
      ...ADMIN_SESSION_USER,
      role,
      display_name: role === "admin" ? "Akari K." : "Phumin M.",
      email: role === "admin" ? "akari.k@ubk.ac.th" : "phumin.m@ubk.ac.th",
    },
    scopes,
  };
}

export function hasScope(session: Session, scope: string): boolean {
  return session.scopes.includes(scope);
}

export function hasAnyScope(session: Session, prefix: string): boolean {
  return session.scopes.some((s) => s.startsWith(prefix));
}
