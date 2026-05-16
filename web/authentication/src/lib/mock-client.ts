export type DemoClient = {
  id: string;
  name: string;
  brand_color: string;
  redirect_uri: string;
  scopes: { key: string; label: string; description: string }[];
  acr_required: "iden:loa:1" | "iden:loa:2" | "iden:loa:3";
};

export const ATTENDE: DemoClient = {
  id: "attende-prod",
  name: "ATTENDE",
  brand_color: "#3aa6ff",
  redirect_uri: "https://attende.ubk.ac.th/oidc/callback",
  scopes: [
    {
      key: "openid · profile · email",
      label: "Your name and email",
      description: "Used to identify you across ATTENDE.",
    },
    {
      key: "admin:clients:read",
      label: "Read your registered OIDC clients",
      description: "View metadata about OIDC clients you administer.",
    },
    {
      key: "admin:kiosks:read",
      label: "List linked kiosk devices",
      description: "See which kiosks are bound to your organization.",
    },
  ],
  acr_required: "iden:loa:2",
};

export const ORG = {
  name: "University of Bangkok",
  short: "UBK",
  domain: "ubk.ac.th",
};

export const DEMO_USER = {
  email: "akari.k@ubk.ac.th",
  display_name: "Akari Kobayashi",
  password: "demo-password",
  totp: "482175",
};
