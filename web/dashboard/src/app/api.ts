import { createClient } from "@iden/shared";
import type { AxiosInstance } from "axios";
import { useAuth } from "react-oidc-context";
import { useMemo } from "react";
import { config } from "./config";

/**
 * The dashboard's client. No cookies: it authenticates with a bearer token and
 * has no business touching `iden_session`, which belongs to auth-ui.
 */
export function useApi(): AxiosInstance {
  const auth = useAuth();
  const token = auth.user?.access_token;

  return useMemo(
    () => createClient({ issuer: config.issuer, withCredentials: false, getToken: () => token }),
    [token],
  );
}
