"use client";

import * as React from "react";
import type { Role, Session } from "@/lib/types";
import { getSessionFor } from "@/lib/api/session";

type Ctx = {
  role: Role;
  session: Session;
  setRole: (r: Role) => void;
};

const RoleContext = React.createContext<Ctx | null>(null);

const STORAGE_KEY = "iden_dev_role";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<Role>("admin");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "user" || stored === "admin") setRoleState(stored);
    setHydrated(true);
  }, []);

  const setRole = React.useCallback((r: Role) => {
    setRoleState(r);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, r);
  }, []);

  const session = React.useMemo(() => getSessionFor(role), [role]);

  const value = React.useMemo(() => ({ role, session, setRole }), [role, session, setRole]);

  return (
    <RoleContext.Provider value={value}>
      <div suppressHydrationWarning style={{ visibility: hydrated ? undefined : "hidden" }}>
        {children}
      </div>
    </RoleContext.Provider>
  );
}

export function useRoleSession(): Ctx {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error("useRoleSession must be inside RoleProvider");
  return ctx;
}
