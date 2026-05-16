"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Users,
  MonitorSmartphone,
  KeyRound,
  ShieldCheck,
  ScrollText,
  Building2,
  User,
  Lock,
  Smartphone,
  Scan,
  ShieldUser,
} from "lucide-react";
import { useRoleSession } from "@/lib/role-context";
import { hasAnyScope, hasScope } from "@/lib/api/session";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  scope?: string;
};

export function Sidebar({
  clientCount,
  userCount,
  kioskCount,
}: {
  clientCount: number;
  userCount: number;
  kioskCount: number;
}) {
  const { session } = useRoleSession();
  const pathname = usePathname();

  const adminNav: NavItem[] = [
    { href: "/admin/clients", label: "Clients", icon: Boxes, count: clientCount, scope: "admin:clients:read" },
    { href: "/admin/users", label: "Users", icon: Users, count: userCount, scope: "admin:users:read" },
    { href: "/admin/kiosks", label: "Kiosks", icon: MonitorSmartphone, count: kioskCount, scope: "admin:kiosks:read" },
    { href: "/admin/scopes", label: "Scopes", icon: KeyRound, scope: "admin:scopes:read" },
    { href: "/admin/audit", label: "Audit", icon: ScrollText, scope: "admin:audit:read" },
    { href: "/admin/organization", label: "Organization", icon: Building2, scope: "admin:org:read" },
  ];

  const accountNav: NavItem[] = [
    { href: "/account/profile", label: "Profile", icon: User },
    { href: "/account/credentials", label: "Credentials", icon: Lock },
    { href: "/account/totp", label: "TOTP", icon: ShieldCheck },
    { href: "/account/biometric", label: "Biometric", icon: Scan },
    { href: "/account/sessions", label: "Sessions", icon: Smartphone },
  ];

  const showAdmin = hasAnyScope(session, "admin:");

  return (
    <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)] text-[var(--color-text-inverse)]">
          <ShieldUser className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide text-[var(--color-text-primary)]">IDEN</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            {session.user.org_name}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {showAdmin ? (
          <NavSection title="Admin" items={adminNav} pathname={pathname} session={session} />
        ) : null}
        <NavSection title="Account" items={accountNav} pathname={pathname} session={session} />
      </nav>

      <div className="border-t border-[var(--color-border-subtle)] px-3 py-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials(session.user.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {session.user.display_name}
            </div>
            <div className="truncate text-xs text-[var(--color-text-secondary)] capitalize">
              {session.user.role === "admin" ? "Administrator" : "Member"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavSection({
  title,
  items,
  pathname,
  session,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  session: ReturnType<typeof useRoleSession>["session"];
}) {
  const visible = items.filter((i) => !i.scope || hasScope(session, i.scope));
  if (visible.length === 0) return null;
  return (
    <div className="mt-4 first:mt-2">
      <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        {title}
      </div>
      <ul className="space-y-0.5">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[var(--color-primary-muted)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {typeof item.count === "number" ? (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[20px] items-center justify-center rounded-md px-1.5 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                        : "bg-[var(--color-surface-overlay)] text-[var(--color-text-tertiary)]"
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
