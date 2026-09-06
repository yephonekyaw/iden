import { useCallback, useEffect, useState } from "react";
import type { Discovery, Exchange, TokenResponse } from "./oidc";

/**
 * Everything the playground has to remember across the redirect.
 *
 * An authorization request leaves the page and comes back to a different URL,
 * so the `code_verifier`, `state` and `nonce` cannot live in React state — they
 * have to survive a full navigation or the exchange cannot be completed and
 * nothing can be checked against what was sent.
 *
 * `sessionStorage`, not `localStorage`: these are single-use secrets for one
 * attempt, and a verifier left on disk after the tab closes is a verifier
 * somebody else can read. The *configuration* is a convenience rather than a
 * secret, so that one does persist.
 */

export interface Config {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  responseType: string;
  prompt: string;
  acrValues: string;
  maxAge: string;
  loginHint: string;
  usePkce: boolean;
  useState: boolean;
  useNonce: boolean;
}

export const DEFAULT_CONFIG: Config = {
  issuer: "http://localhost:8000",
  clientId: "playground",
  clientSecret: "",
  redirectUri: `${window.location.origin}/callback`,
  scope: "openid profile email offline_access",
  responseType: "code",
  prompt: "",
  acrValues: "",
  maxAge: "",
  loginHint: "",
  usePkce: true,
  useState: true,
  useNonce: true,
};

/** The one attempt currently in flight, or the one that just finished. */
export interface Attempt {
  codeVerifier?: string;
  codeChallenge?: string;
  state?: string;
  nonce?: string;
  authorizeUrl?: string;
  /** Exactly what came back on the redirect, before anything is done with it. */
  callback?: Record<string, string>;
  exchange?: Exchange;
  tokens?: TokenResponse;
}

const CONFIG_KEY = "iden.playground.config";
const ATTEMPT_KEY = "iden.playground.attempt";
const DISCOVERY_KEY = "iden.playground.discovery";

function read<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as object) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // A private window with storage blocked. The playground still works for one
    // page load; only the redirect round-trip is lost, and that is worth saying
    // nothing about until it actually fails.
  }
}

export function useConfig() {
  const [config, setConfig] = useState<Config>(() =>
    read(window.localStorage, CONFIG_KEY, DEFAULT_CONFIG),
  );

  useEffect(() => write(window.localStorage, CONFIG_KEY, config), [config]);

  const update = useCallback(
    (patch: Partial<Config>) => setConfig((current) => ({ ...current, ...patch })),
    [],
  );

  return { config, update, reset: () => setConfig(DEFAULT_CONFIG) };
}

export function useAttempt() {
  const [attempt, setAttempt] = useState<Attempt>(() =>
    read(window.sessionStorage, ATTEMPT_KEY, {} as Attempt),
  );

  useEffect(() => write(window.sessionStorage, ATTEMPT_KEY, attempt), [attempt]);

  const update = useCallback(
    (patch: Partial<Attempt>) => setAttempt((current) => ({ ...current, ...patch })),
    [],
  );

  const clear = useCallback(() => {
    setAttempt({});
    window.sessionStorage.removeItem(ATTEMPT_KEY);
  }, []);

  return { attempt, update, clear };
}

export function useDiscovery() {
  const [discovery, setDiscovery] = useState<Discovery | null>(() => {
    try {
      const raw = window.sessionStorage.getItem(DISCOVERY_KEY);
      return raw ? (JSON.parse(raw) as Discovery) : null;
    } catch {
      return null;
    }
  });

  const save = useCallback((next: Discovery | null) => {
    setDiscovery(next);
    if (next) write(window.sessionStorage, DISCOVERY_KEY, next);
    else window.sessionStorage.removeItem(DISCOVERY_KEY);
  }, []);

  return { discovery, save };
}
