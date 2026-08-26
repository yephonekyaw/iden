import { Badge, Brand, cn, Mark, Menu } from "@iden/shared";
import {
  AppWindow,
  Boxes,
  KeyRound,
  ListChecks,
  LogOut,
  ChevronsUpDown,
  Menu as MenuIcon,
  MonitorSmartphone,
  Plug,
  ScrollText,
  Server,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { NavLink, Outlet, useLocation } from "react-router";
import { config } from "./config";
import { useGrantedScopes, useSignOut } from "./session";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** The read scope that makes this section usable at all. */
  scope: string;
}

const ACCOUNT: NavItem[] = [
  { to: "/account/profile", label: "Profile", icon: UserRound, scope: "entity:profile:read" },
  { to: "/account/security", label: "Security", icon: ShieldCheck, scope: "entity:totp:read" },
  {
    to: "/account/sessions",
    label: "Sessions",
    icon: MonitorSmartphone,
    scope: "entity:sessions:read",
  },
  {
    to: "/account/connections",
    label: "Connections",
    icon: Plug,
    scope: "entity:connections:read",
  },
  {
    to: "/account/permissions",
    label: "Permissions",
    icon: KeyRound,
    scope: "entity:permissions:read",
  },
];

const ADMIN: NavItem[] = [
  { to: "/admin/users", label: "Users", icon: UsersRound, scope: "admin:users:read" },
  { to: "/admin/groups", label: "Groups", icon: Boxes, scope: "admin:groups:read" },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck, scope: "admin:roles:read" },
  { to: "/admin/apis", label: "APIs", icon: Server, scope: "admin:apis:read" },
  { to: "/admin/clients", label: "Clients", icon: AppWindow, scope: "admin:clients:read" },
  {
    to: "/admin/profile-fields",
    label: "Profile fields",
    icon: ListChecks,
    scope: "admin:profile-fields:read",
  },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, scope: "admin:audit:read" },
];

const SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: "Your account", items: ACCOUNT },
  { title: "Administration", items: ADMIN },
];

function Section({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-7">
      <p className="px-3 pb-2 text-caption-upper uppercase text-on-dark-soft/70">{title}</p>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-md py-2 pl-3.5 pr-3",
                  "text-body-sm transition-colors duration-100",
                  // The coral is scarce: one mark per view, on the section you
                  // are actually in.
                  "before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[2px]",
                  "before:-translate-y-1/2 before:rounded-full before:bg-primary",
                  "before:transition-opacity before:duration-100",
                  isActive
                    ? "bg-surface-dark-elevated text-on-dark before:opacity-100"
                    : "text-on-dark-soft before:opacity-0 hover:bg-surface-dark-soft hover:text-on-dark",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    aria-hidden="true"
                    className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-current")}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The initials the avatar falls back to; there are no uploaded pictures here. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts.at(0) ?? "";
  const last = parts.at(-1) ?? "";
  if (!first) return "?";
  const letters = parts.length === 1 ? first.slice(0, 2) : first.slice(0, 1) + last.slice(0, 1);
  return letters.toUpperCase();
}

function AccountMenu({ name, email }: { name: string; email: string }) {
  const signOut = useSignOut();

  return (
    <Menu>
      <Menu.Trigger
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left",
          "transition-colors duration-100 hover:bg-surface-dark-soft",
          "data-[state=open]:bg-surface-dark-soft",
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-dark-elevated text-caption text-on-dark"
        >
          {initials(name || email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-sm text-on-dark">{name || email}</span>
          {name && email ? (
            <span className="block truncate text-caption text-on-dark-soft">{email}</span>
          ) : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-on-dark-soft" />
        <span className="sr-only">Account menu</span>
      </Menu.Trigger>

      <Menu.Content side="top" align="start" className="w-56">
        <Menu.Label>Signed in as</Menu.Label>
        <p className="truncate px-2.5 pb-2 text-body-sm text-ink">{email || name}</p>
        <Menu.Separator />
        <Menu.Item onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}

export function Shell() {
  const auth = useAuth();
  const granted = useGrantedScopes();
  const [open, setOpen] = useState(false);

  const name = auth.user?.profile.name ?? auth.user?.profile.preferred_username ?? "";
  const email = auth.user?.profile.email ?? "";

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => granted.has(item.scope)),
  }));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* The rail keeps its own scroll and its own height, so a long table in
          the content column never drags the navigation off the screen. */}
      <nav
        aria-label="Sections"
        className={cn(
          "flex shrink-0 flex-col bg-surface-dark",
          "md:sticky md:top-0 md:h-dvh md:w-64 md:self-start",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-6">
          <Brand branding={config.branding} className="min-w-0 text-on-dark" />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="rail-sections"
            className="-mr-2 rounded-md p-2 text-on-dark-soft hover:text-on-dark md:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <MenuIcon aria-hidden="true" className="h-5 w-5" />
            )}
            <span className="sr-only">{open ? "Close navigation" : "Open navigation"}</span>
          </button>
        </div>

        <div
          id="rail-sections"
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 pb-2 md:px-5",
            open ? "block" : "hidden md:block",
          )}
        >
          {sections.map((section) => (
            <Section
              key={section.title}
              title={section.title}
              items={section.items}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </div>

        <div
          className={cn(
            "border-t border-hairline-dark p-3 md:p-4",
            open ? "block" : "hidden md:block",
          )}
        >
          <AccountMenu name={name} email={email} />
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-6 py-10 md:px-12">
        <div className="mx-auto max-w-[1000px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** Where the current route sits in the rail, so a page never has to say it twice. */
function useTrail(): string[] {
  const { pathname } = useLocation();

  for (const section of SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.to) return [section.title];
      if (pathname.startsWith(`${item.to}/`)) return [section.title, item.label];
    }
  }
  return [];
}

/**
 * A page heading, in the display serif. The eyebrow repeats where the rail says
 * you are — on a detail page that is the only thing naming the list you came
 * from. `count` and `actions` belong to lists; both are optional.
 */
export function PageHeader({
  title,
  lede,
  count,
  actions,
}: {
  title: string;
  lede: string;
  count?: number;
  actions?: ReactNode;
}) {
  const trail = useTrail();

  return (
    <header className="mb-8 border-b border-hairline pb-6">
      {trail.length > 0 ? (
        <p className="flex items-center gap-2 text-caption-upper uppercase text-muted">
          <Mark className="h-3 w-3 text-primary" />
          {trail.join(" · ")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-display-md">
            {title}
            {count !== undefined ? <Badge tone="outline">{count}</Badge> : null}
          </h1>
          <p className="mt-2 max-w-prose text-body-md text-body">{lede}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
