"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, LogOut, Settings, UserCog } from "lucide-react";
import { useRoleSession } from "@/lib/role-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

const SEGMENT_LABEL: Record<string, string> = {
  admin: "Admin",
  account: "Account",
  clients: "Clients",
  users: "Users",
  kiosks: "Kiosks",
  scopes: "Scopes",
  audit: "Audit",
  organization: "Organization",
  profile: "Profile",
  credentials: "Credentials",
  totp: "TOTP",
  biometric: "Biometric",
  sessions: "Sessions",
  new: "New",
};

export function Topbar() {
  const pathname = usePathname();
  const { role, setRole, session } = useRoleSession();

  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/85 px-6 backdrop-blur">
      <nav className="flex items-center gap-2 text-sm">
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;
          const label = SEGMENT_LABEL[seg] ?? seg;
          return (
            <React.Fragment key={href}>
              {i > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
              ) : null}
              {isLast ? (
                <span className="font-medium text-[var(--color-text-primary)]">{label}</span>
              ) : (
                <Link
                  href={href}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  {label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials(session.user.display_name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account/profile" className="cursor-pointer">
                <UserCog className="h-4 w-4" /> Profile settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Dev · view as</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={role === "admin"} onCheckedChange={() => setRole("admin")}>
              Administrator
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={role === "user"} onCheckedChange={() => setRole("user")}>
              End user
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="h-4 w-4" /> Preferences
            </DropdownMenuItem>
            <DropdownMenuItem danger>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
