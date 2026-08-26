import { createClient, get, readIssuer, type components } from "@iden/shared";

export type Challenge = components["schemas"]["ChallengeResponse"];
export type AuthStep = components["schemas"]["AuthStepResponse"];
export type ConsentResult = components["schemas"]["ConsentResponse"];

const issuer = readIssuer(import.meta.env.VITE_IDEN_ISSUER);

/**
 * Cookies are included on every call: login and consent set `iden_session`, and
 * the browser stores it only for a credentialed request. This is also why the
 * provider's CORS allowlist has to name this origin exactly — a wildcard is not
 * permitted with credentials.
 */
const client = createClient({ issuer, withCredentials: true });

export function readChallenge(challengeId: string): Promise<Challenge> {
  return get<Challenge>(client, `/api/v1/auth/challenge/${challengeId}`);
}

export async function signIn(body: {
  challengeId: string;
  email: string;
  password: string;
}): Promise<AuthStep> {
  const response = await client.post<AuthStep>("/api/v1/auth/login", body);
  return response.data;
}

export async function submitTotp(body: { challengeId: string; code: string }): Promise<AuthStep> {
  const response = await client.post<AuthStep>("/api/v1/auth/totp", body);
  return response.data;
}

export async function decideConsent(body: {
  challengeId: string;
  approved: boolean;
}): Promise<ConsentResult> {
  const response = await client.post<ConsentResult>("/api/v1/auth/consent", body);
  return response.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await client.post("/api/v1/auth/password-reset", { email });
}

export async function confirmPasswordReset(body: {
  token: string;
  newPassword: string;
}): Promise<void> {
  await client.post("/api/v1/auth/password-reset/confirm", body);
}

/**
 * Whether this deployment offers face as a sign-in method. The biometric module
 * is feature-flagged, and its login endpoint answers 501 when it is off — so the
 * picker asks discovery rather than offering an option that cannot work.
 */
export async function biometricAvailable(): Promise<boolean> {
  const config = await get<{ amr_values_supported?: string[] }>(
    client,
    "/.well-known/openid-configuration",
  );
  return config.amr_values_supported?.includes("face") ?? false;
}
