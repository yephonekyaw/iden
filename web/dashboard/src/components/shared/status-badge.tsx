import { Badge } from "@/components/ui/badge";
import type { ClientKind, ClientStatus, KioskStatus, UserStatus, ScopeResource } from "@/lib/types";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge tone={status === "active" ? "success" : "danger"}>{status}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const tone = status === "active" ? "success" : status === "pending" ? "warning" : "danger";
  return <Badge tone={tone}>{status}</Badge>;
}

export function KioskStatusBadge({ status }: { status: KioskStatus }) {
  const tone = status === "active" ? "success" : status === "inactive" ? "warning" : "neutral";
  const label = status === "never_connected" ? "never connected" : status;
  return <Badge tone={tone}>{label}</Badge>;
}

export function ClientKindBadge({ kind }: { kind: ClientKind }) {
  const tone =
    kind === "web" ? "info" : kind === "spa" ? "violet" : kind === "kiosk" ? "accent" : "neutral";
  return <Badge tone={tone}>{kind}</Badge>;
}

export function RoleBadge({ role }: { role: "admin" | "user" }) {
  return <Badge tone={role === "admin" ? "accent" : "neutral"}>{role}</Badge>;
}

export function ResourceBadge({ resource }: { resource: ScopeResource }) {
  const tone =
    resource === "admin"
      ? "accent"
      : resource === "entity"
      ? "info"
      : resource === "biometric"
      ? "violet"
      : "neutral";
  return <Badge tone={tone}>{resource}</Badge>;
}

export function ActionBadge({ action }: { action: "read" | "write" | null }) {
  if (!action) return null;
  return <Badge tone={action === "write" ? "violet" : "info"}>{action}</Badge>;
}
