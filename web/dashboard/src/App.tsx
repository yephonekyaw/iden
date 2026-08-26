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
        <div className="max-w-md">
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
