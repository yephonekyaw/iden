export type Role = "admin" | "user";

export type Session = {
  user: {
    id: string;
    display_name: string;
    email: string;
    role: Role;
    org_name: string;
    org_slug: string;
  };
  scopes: string[];
};

export type ClientKind = "web" | "spa" | "kiosk" | "service";
export type ClientStatus = "active" | "disabled";

export type OIDCClient = {
  id: string;
  name: string;
  description: string | null;
  kind: ClientKind;
  status: ClientStatus;
  is_public: boolean;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  require_pkce: boolean;
  allowed_scopes: string[];
  audience: string[];
  access_token_ttl_seconds: number;
  refresh_token_ttl_seconds: number;
  id_token_ttl_seconds: number;
  refresh_token_rotation: boolean;
  consent_required: boolean;
  logo_uri: string | null;
  client_uri: string | null;
  tos_uri: string | null;
  policy_uri: string | null;
  contacts: string[];
  org_id: string;
  created_at: string;
  updated_at: string;
};

export type UserStatus = "active" | "pending" | "disabled";

export type User = {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  status: UserStatus;
  org_id: string;
  enrolled: { password: boolean; totp: boolean; biometric: boolean };
  last_login_at: string | null;
  created_at: string;
};

export type KioskStatus = "active" | "inactive" | "never_connected";

export type Kiosk = {
  id: string;
  name: string;
  location: string;
  hw_id: string;
  status: KioskStatus;
  client_id: string;
  last_seen_at: string | null;
  created_at: string;
};

export type ScopeResource = "admin" | "entity" | "biometric" | "openid";

export type Scope = {
  name: string;
  description: string;
  resource: ScopeResource;
  allowed_roles: Role[];
  action: "read" | "write" | null;
};

export type AuditEvent = {
  id: string;
  actor_id: string | null;
  actor_label: string;
  action: string;
  target: string;
  ip_addr: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type Session_Device = {
  id: string;
  device_label: string;
  browser: string;
  ip_addr: string;
  city: string;
  current: boolean;
  created_at: string;
  last_seen_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  primary_color: string | null;
  logo_url: string | null;
  default_access_token_ttl_seconds: number;
  default_refresh_token_ttl_seconds: number;
  created_at: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type OrgUserFieldType = "text" | "number" | "email" | "url" | "date" | "select" | "boolean";

export type OrgUserField = {
  id: string;
  key: string;
  label: string;
  type: OrgUserFieldType;
  required: boolean;
  help_text: string | null;
  placeholder: string | null;
  options: string[] | null;
  order: number;
};

export type UserAttributes = Record<string, string | number | boolean | null>;
