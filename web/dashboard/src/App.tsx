import { Button, ErrorState, Spinner } from "@iden/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { IdenAuthProvider } from "./app/auth";
import { Shell } from "./app/shell";
import { ProfileRoute } from "./features/account/profile";
import { SecurityRoute } from "./features/account/security";
import { ConnectionsRoute, PermissionsRoute, SessionsRoute } from "./features/account/activity";
import { RequireScope } from "./app/RequireScope";
import { UsersRoute, UserDetailRoute } from "./features/admin/users";
import { GroupsRoute, GroupDetailRoute } from "./features/admin/groups";
import { RolesRoute, RoleDetailRoute } from "./features/admin/roles";
import { ApisRoute, ApiDetailRoute } from "./features/admin/apis";
import { ClientsRoute, ClientDetailRoute } from "./features/admin/clients";
import { ProfileFieldsRoute } from "./features/admin/profile-fields";
import { AuditRoute } from "./features/admin/audit";

/** Every admin route is gated on the read scope its endpoints require. */
function guarded(scope: string, element: React.ReactNode) {
  return <RequireScope scope={scope}>{element}</RequireScope>;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/account/profile" replace /> },
      { path: "account/profile", element: <ProfileRoute /> },
      { path: "account/security", element: <SecurityRoute /> },
      { path: "account/sessions", element: <SessionsRoute /> },
      { path: "account/connections", element: <ConnectionsRoute /> },
      { path: "account/permissions", element: <PermissionsRoute /> },

      { path: "admin/users", element: guarded("admin:users:read", <UsersRoute />) },
      { path: "admin/users/:userId", element: guarded("admin:users:read", <UserDetailRoute />) },
      { path: "admin/groups", element: guarded("admin:groups:read", <GroupsRoute />) },
      {
        path: "admin/groups/:groupId",
        element: guarded("admin:groups:read", <GroupDetailRoute />),
      },
      { path: "admin/roles", element: guarded("admin:roles:read", <RolesRoute />) },
      { path: "admin/roles/:roleId", element: guarded("admin:roles:read", <RoleDetailRoute />) },
      { path: "admin/apis", element: guarded("admin:apis:read", <ApisRoute />) },
      { path: "admin/apis/:apiId", element: guarded("admin:apis:read", <ApiDetailRoute />) },
      { path: "admin/clients", element: guarded("admin:clients:read", <ClientsRoute />) },
      {
        path: "admin/clients/:clientId",
        element: guarded("admin:clients:read", <ClientDetailRoute />),
      },
      {
        path: "admin/profile-fields",
        element: guarded("admin:profile-fields:read", <ProfileFieldsRoute />),
      },
      { path: "admin/audit", element: guarded("admin:audit:read", <AuditRoute />) },
      { path: "*", element: <Navigate to="/account/profile" replace /> },
    ],
  },
]);

/**
 * Sits between the OIDC provider and the router: nothing renders until there is
 * a token, and a signed-out visitor is sent straight to `/authorize` rather than
 * shown a landing page they cannot use.
 */
function RequireSignIn({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.activeNavigator || auth.isLoading) {
    return <Centered>{<Spinner label="Signing you in" />}</Centered>;
  }

  if (auth.error) {
    return (
      <Centered>
        <div className="max-w-md flex flex-col justify-center items-center">
          <ErrorState error={auth.error} />
          <Button className="mt-4" variant="primary" onClick={() => void auth.signinRedirect()}>
            Try signing in again
          </Button>
        </div>
      </Centered>
    );
  }

  if (!auth.isAuthenticated) {
    void auth.signinRedirect();
    return <Centered>{<Spinner label="Redirecting to sign in" />}</Centered>;
  }

  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center px-6">{children}</div>;
}

export function App() {
  return (
    <IdenAuthProvider>
      <QueryClientProvider client={queryClient}>
        <RequireSignIn>
          <RouterProvider router={router} />
        </RequireSignIn>
      </QueryClientProvider>
    </IdenAuthProvider>
  );
}
