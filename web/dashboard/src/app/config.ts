import { readBranding, readIssuer } from "@iden/shared";

export const config = {
  issuer: readIssuer(import.meta.env.VITE_IDEN_ISSUER),
  redirectUri: `${window.location.origin}/callback`,
  branding: readBranding({
    organization: import.meta.env.VITE_IDEN_ORG_NAME,
    logoUrl: import.meta.env.VITE_IDEN_ORG_LOGO,
  }),
};
