import { readIssuer } from "@iden/shared";

export const config = {
  issuer: readIssuer(import.meta.env.VITE_IDEN_ISSUER),
  redirectUri: `${window.location.origin}/callback`,
};
