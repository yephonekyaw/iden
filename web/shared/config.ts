/**
 * Runtime configuration.
 *
 * `/config.js` is written by the container at start-up, so one image serves any
 * issuer and any organization; `import.meta.env` covers `pnpm dev`, where there
 * is no container.
 */
declare global {
  interface Window {
    __IDEN_CONFIG__?: {
      issuer?: string;
      organization?: string;
      organizationLogoUrl?: string;
    };
  }
}

export function readIssuer(fallback: string | undefined): string {
  return window.__IDEN_CONFIG__?.issuer ?? fallback ?? "http://localhost:8000";
}

/**
 * Who this deployment belongs to. IDEN is the software; the organization is
 * whose sign-in page this is, so it takes the larger type wherever both appear.
 * Absent for a deployment that has not set one, and then IDEN stands alone.
 */
export interface Branding {
  organization: string | null;
  logoUrl: string | null;
}

export function readBranding(fallback: { organization?: string; logoUrl?: string }): Branding {
  const runtime = window.__IDEN_CONFIG__;
  return {
    organization: runtime?.organization || fallback.organization || null,
    logoUrl: runtime?.organizationLogoUrl || fallback.logoUrl || null,
  };
}
