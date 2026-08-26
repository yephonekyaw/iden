import { readBranding } from "@iden/shared";

export const branding = readBranding({
  organization: import.meta.env.VITE_IDEN_ORG_NAME,
  logoUrl: import.meta.env.VITE_IDEN_ORG_LOGO,
});
