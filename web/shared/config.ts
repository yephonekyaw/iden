/**
 * Runtime configuration.
 *
 * `/config.js` is written by the container at start-up, so one image serves any
 * issuer; `import.meta.env` covers `pnpm dev`, where there is no container.
 */
declare global {
  interface Window {
    __IDEN_CONFIG__?: { issuer?: string };
  }
}

export function readIssuer(fallback: string | undefined): string {
  return window.__IDEN_CONFIG__?.issuer ?? fallback ?? "http://localhost:8000";
}
