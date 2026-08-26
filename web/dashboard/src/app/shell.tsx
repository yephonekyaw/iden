import { cn } from "@iden/shared";
import { useAuth } from "react-oidc-context";
import { NavLink, Outlet } from "react-router";
import { useGrantedScopes, useSignOut } from "./session";

interface NavItem {
  to: string;
  label: string;
  /** The read scope that makes this section usable at all. */
  scope: string;
}

const ACCOUNT: NavItem[] = [
  { to: "/account/profile", label: "Profile", scope: "entity:profile:read" },
  { to: "/account/security", label: "Security", scope: "entity:totp:read" },
  { to: "/account/sessions", label: "Sessions", scope: "entity:sessions:read" },
  { to: "/account/connections", label: "Connections", scope: "entity:connections:read" },
  { to: "/account/permissions", label: "Permissions", scope: "entity:permissions:read" },
];

const ADMIN: NavItem[] = [
  { to: "/admin/users", label: "Users", scope: "admin:users:read" },
  { to: "/admin/groups", label: "Groups", scope: "admin:groups:read" },
  { to: "/admin/roles", label: "Roles", scope: "admin:roles:read" },
  { to: "/admin/apis", label: "APIs", scope: "admin:apis:read" },
  { to: "/admin/clients", label: "Clients", scope: "admin:clients:read" },
  { to: "/admin/profile-fields", label: "Profile fields", scope: "admin:profile-fields:read" },
  { to: "/admin/audit", label: "Audit log", scope: "admin:audit:read" },
];

function Section({ title, items }: { title: string; items: NavItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-8">
      <p className="px-3 pb-2 text-caption-upper uppercase text-on-dark-soft">{title}</p>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-3 py-2 text-body-sm transition-colors duration-100",
                  isActive
                    ? "bg-surface-dark-elevated text-on-dark"
                    : "text-on-dark-soft hover:bg-surface-dark-soft hover:text-on-dark",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Shell() {
  const auth = useAuth();
  const granted = useGrantedScopes();
  const signOut = useSignOut();
  const visible = (items: NavItem[]) => items.filter((item) => granted.has(item.scope));

  const name = auth.user?.profile.name ?? auth.user?.profile.preferred_username ?? "";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <nav
        aria-label="Sections"
        className="flex shrink-0 flex-col bg-surface-dark p-4 md:w-64 md:p-6"
      >
        <p className="mb-8 px-3 font-display text-title-lg tracking-[0.18em] text-on-dark">IDEN</p>

        <div className="flex-1">
          <Section title="Your account" items={visible(ACCOUNT)} />
          <Section title="Administration" items={visible(ADMIN)} />
        </div>

        <div className="border-t border-hairline-dark px-3 pt-4">
          <p className="truncate text-body-sm text-on-dark">{name}</p>
          <button
            type="button"
            className="mt-1 text-caption text-on-dark-soft underline-offset-2 hover:text-on-dark hover:underline"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
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

/** A page heading, in the display serif, with one line saying what the page is for. */
export function PageHeader({ title, lede }: { title: string; lede: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-display-md">{title}</h1>
      <p className="mt-2 max-w-prose text-body-md text-body">{lede}</p>
    </header>
  );
}
