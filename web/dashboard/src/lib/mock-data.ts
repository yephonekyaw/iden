import type {
  AuditEvent,
  Kiosk,
  OIDCClient,
  OrgUserField,
  Organization,
  Scope,
  Session_Device,
  User,
  UserAttributes,
} from "./types";

const ORG_ID = "org_ubk";

export const ORG: Organization = {
  id: ORG_ID,
  name: "University of Bangkok",
  slug: "ubk",
  primary_color: "#ff7a1a",
  logo_url: null,
  default_access_token_ttl_seconds: 3600,
  default_refresh_token_ttl_seconds: 1_209_600,
  created_at: "2024-11-02T09:00:00Z",
};

export const SCOPES: Scope[] = [
  { name: "admin:clients:read", description: "List and view OIDC clients", resource: "admin", allowed_roles: ["admin"], action: "read" },
  { name: "admin:clients:write", description: "Create, update, and delete clients", resource: "admin", allowed_roles: ["admin"], action: "write" },
  { name: "admin:users:read", description: "List and view user accounts", resource: "admin", allowed_roles: ["admin"], action: "read" },
  { name: "admin:users:write", description: "Create, update, deactivate accounts", resource: "admin", allowed_roles: ["admin"], action: "write" },
  { name: "admin:kiosks:read", description: "List kiosk devices", resource: "admin", allowed_roles: ["admin"], action: "read" },
  { name: "admin:kiosks:write", description: "Register and manage kiosks", resource: "admin", allowed_roles: ["admin"], action: "write" },
  { name: "admin:scopes:read", description: "Read the scope catalog", resource: "admin", allowed_roles: ["admin"], action: "read" },
  { name: "admin:audit:read", description: "Read the audit log", resource: "admin", allowed_roles: ["admin"], action: "read" },
  { name: "admin:org:read", description: "Read organization settings", resource: "admin", allowed_roles: ["admin"], action: "read" },
  { name: "admin:org:write", description: "Update organization settings", resource: "admin", allowed_roles: ["admin"], action: "write" },
  { name: "admin:user_schema:read", description: "Read the org-defined user field schema", resource: "admin", allowed_roles: ["admin"], action: "read" },
  { name: "admin:user_schema:write", description: "Define and modify custom user fields", resource: "admin", allowed_roles: ["admin"], action: "write" },

  { name: "entity:profile:read", description: "Read own profile data", resource: "entity", allowed_roles: ["admin", "user"], action: "read" },
  { name: "entity:profile:write", description: "Update display name and photo", resource: "entity", allowed_roles: ["admin", "user"], action: "write" },
  { name: "entity:credentials:read", description: "Read enrolled credential methods", resource: "entity", allowed_roles: ["admin", "user"], action: "read" },
  { name: "entity:credentials:write", description: "Change password", resource: "entity", allowed_roles: ["admin", "user"], action: "write" },
  { name: "entity:totp:enroll", description: "Enroll a TOTP authenticator", resource: "entity", allowed_roles: ["admin", "user"], action: "write" },
  { name: "entity:sessions:read", description: "Read your active sessions", resource: "entity", allowed_roles: ["admin", "user"], action: "read" },
  { name: "entity:sessions:write", description: "Revoke your active sessions", resource: "entity", allowed_roles: ["admin", "user"], action: "write" },

  { name: "biometric:enroll", description: "Enroll a face for an entity", resource: "biometric", allowed_roles: ["admin"], action: "write" },
  { name: "biometric:verify", description: "Verify a face against enrolled embeddings", resource: "biometric", allowed_roles: ["admin"], action: "read" },
  { name: "biometric:liveness", description: "Run a liveness check on a captured frame", resource: "biometric", allowed_roles: ["admin"], action: "read" },

  { name: "openid", description: "Standard OIDC identity scope", resource: "openid", allowed_roles: ["admin", "user"], action: "read" },
  { name: "profile", description: "Basic profile claims (name, picture)", resource: "openid", allowed_roles: ["admin", "user"], action: "read" },
  { name: "email", description: "Email and verification status", resource: "openid", allowed_roles: ["admin", "user"], action: "read" },
];

export const CLIENTS: OIDCClient[] = [
  {
    id: "iden_clt_a8f3b2c1d9e7",
    name: "Attende",
    description: "Attendance & learning",
    kind: "web",
    status: "active",
    is_public: false,
    redirect_uris: ["https://attende.ubk.ac.th/auth/callback"],
    post_logout_redirect_uris: ["https://attende.ubk.ac.th/"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_basic",
    require_pkce: true,
    allowed_scopes: ["openid", "profile", "email", "entity:profile:read"],
    audience: ["https://attende.ubk.ac.th/api"],
    access_token_ttl_seconds: 3600,
    refresh_token_ttl_seconds: 1_209_600,
    id_token_ttl_seconds: 3600,
    refresh_token_rotation: true,
    consent_required: true,
    logo_uri: null,
    client_uri: "https://attende.ubk.ac.th",
    tos_uri: null,
    policy_uri: null,
    contacts: ["it@ubk.ac.th"],
    org_id: ORG_ID,
    created_at: "2025-03-12T10:24:00Z",
    updated_at: "2025-03-12T10:24:00Z",
  },
  {
    id: "iden_clt_d4e5f6017a2b",
    name: "UBK Portal",
    description: "Admin portal",
    kind: "spa",
    status: "active",
    is_public: true,
    redirect_uris: ["https://portal.ubk.ac.th/cb"],
    post_logout_redirect_uris: ["https://portal.ubk.ac.th/"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    require_pkce: true,
    allowed_scopes: ["openid", "profile", "email", "admin:clients:read", "admin:users:read"],
    audience: ["https://portal.ubk.ac.th/api"],
    access_token_ttl_seconds: 1800,
    refresh_token_ttl_seconds: 604_800,
    id_token_ttl_seconds: 1800,
    refresh_token_rotation: true,
    consent_required: false,
    logo_uri: null,
    client_uri: "https://portal.ubk.ac.th",
    tos_uri: null,
    policy_uri: null,
    contacts: [],
    org_id: ORG_ID,
    created_at: "2025-01-05T08:10:00Z",
    updated_at: "2025-01-05T08:10:00Z",
  },
  {
    id: "iden_clt_k9c2d8e4f10a",
    name: "Entry Kiosk A1",
    description: "Building A · Floor 1",
    kind: "kiosk",
    status: "active",
    is_public: false,
    redirect_uris: [],
    post_logout_redirect_uris: [],
    grant_types: ["client_credentials"],
    response_types: [],
    token_endpoint_auth_method: "client_secret_basic",
    require_pkce: false,
    allowed_scopes: ["biometric:enroll", "biometric:verify", "biometric:liveness"],
    audience: ["https://iden.ubk.ac.th/biometric"],
    access_token_ttl_seconds: 900,
    refresh_token_ttl_seconds: 0,
    id_token_ttl_seconds: 0,
    refresh_token_rotation: false,
    consent_required: false,
    logo_uri: null,
    client_uri: null,
    tos_uri: null,
    policy_uri: null,
    contacts: [],
    org_id: ORG_ID,
    created_at: "2025-02-20T11:45:00Z",
    updated_at: "2025-02-20T11:45:00Z",
  },
  {
    id: "iden_clt_m1n2o3p4q5r6",
    name: "LMS Service",
    description: "M2M backend",
    kind: "service",
    status: "disabled",
    is_public: false,
    redirect_uris: [],
    post_logout_redirect_uris: [],
    grant_types: ["client_credentials"],
    response_types: [],
    token_endpoint_auth_method: "client_secret_basic",
    require_pkce: false,
    allowed_scopes: ["admin:users:read"],
    audience: ["https://lms.ubk.ac.th/api"],
    access_token_ttl_seconds: 3600,
    refresh_token_ttl_seconds: 0,
    id_token_ttl_seconds: 0,
    refresh_token_rotation: false,
    consent_required: false,
    logo_uri: null,
    client_uri: null,
    tos_uri: null,
    policy_uri: null,
    contacts: ["lms@ubk.ac.th"],
    org_id: ORG_ID,
    created_at: "2024-12-01T09:00:00Z",
    updated_at: "2024-12-01T09:00:00Z",
  },
];

const USER_FIRST = [
  "Akari", "Phumin", "Nattaya", "Krit", "Sirawan", "Pichit", "Wanida", "Somchai",
  "Malee", "Anan", "Pranee", "Suthep", "Ying", "Kanya", "Tawan", "Niran",
  "Arun", "Kessara", "Boonmee", "Chayada", "Decha", "Fai", "Gan", "Hathai",
];
const USER_LAST = ["K.", "M.", "W.", "T.", "R.", "S.", "N.", "P.", "L.", "C."];

function randomDateWithin(days: number): string {
  const ms = Date.now() - Math.floor(Math.random() * days * 86_400_000);
  return new Date(ms).toISOString();
}

function seedUsers(count: number): User[] {
  const arr: User[] = [];
  for (let i = 0; i < count; i++) {
    const first = USER_FIRST[i % USER_FIRST.length];
    const last = USER_LAST[i % USER_LAST.length];
    const slug = `${first.toLowerCase()}.${last.toLowerCase().replace(".", "")}`;
    const role: User["role"] = i === 0 ? "admin" : i % 17 === 0 ? "admin" : "user";
    const statuses: User["status"][] = ["active", "active", "active", "active", "pending", "disabled"];
    const status = statuses[i % statuses.length];
    arr.push({
      id: `usr_${(i + 1).toString().padStart(6, "0")}`,
      display_name: `${first} ${last}`,
      email: `${slug}@ubk.ac.th`,
      role,
      status,
      org_id: ORG_ID,
      enrolled: {
        password: true,
        totp: i % 3 === 0,
        biometric: i % 5 === 0,
      },
      last_login_at: status === "active" ? randomDateWithin(7) : null,
      created_at: randomDateWithin(180),
    });
  }
  return arr;
}

export const USERS: User[] = seedUsers(243);

export const KIOSKS: Kiosk[] = [
  {
    id: "ksk_3a8b9c2d",
    name: "Entry Kiosk A1",
    location: "Building A · Floor 1",
    hw_id: "hw_pi4_3a8b9c2d8e4f",
    status: "active",
    client_id: "iden_clt_k9c2d8e4f10a",
    last_seen_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    created_at: "2025-02-20T11:45:00Z",
  },
  {
    id: "ksk_9f2c7e1a",
    name: "Lobby Kiosk B2",
    location: "Building B · Main Lobby",
    hw_id: "hw_pi4_9f2c7e1a3d6b",
    status: "inactive",
    client_id: "iden_clt_k9c2d8e4f10a",
    last_seen_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    created_at: "2025-03-01T14:20:00Z",
  },
];

const AUDIT_ACTIONS = [
  { action: "client.create", target: "iden_clt_a8f3b2c1d9e7" },
  { action: "client.rotate_secret", target: "iden_clt_d4e5f6017a2b" },
  { action: "user.deactivate", target: "usr_000031" },
  { action: "user.role.change", target: "usr_000048" },
  { action: "kiosk.register", target: "ksk_3a8b9c2d" },
  { action: "totp.enroll", target: "usr_000001" },
  { action: "biometric.enroll", target: "usr_000005" },
  { action: "auth.login", target: "usr_000001" },
  { action: "auth.login.failed", target: "usr_000012" },
  { action: "session.revoke", target: "sess_71" },
];

export const AUDIT: AuditEvent[] = Array.from({ length: 80 }).map((_, i) => {
  const e = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length];
  return {
    id: `evt_${(i + 1).toString().padStart(6, "0")}`,
    actor_id: i % 7 === 0 ? null : "usr_000001",
    actor_label: i % 7 === 0 ? "system" : "Akari K.",
    action: e.action,
    target: e.target,
    ip_addr: `10.0.${(i % 256).toString()}.${((i * 7) % 256).toString()}`,
    detail: {},
    created_at: randomDateWithin(30),
  };
});

export const SESSIONS: Session_Device[] = [
  {
    id: "sess_71",
    device_label: "MacBook Pro · macOS 15",
    browser: "Chrome 142",
    ip_addr: "10.0.12.34",
    city: "Bangkok, TH",
    current: true,
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    last_seen_at: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: "sess_64",
    device_label: "iPhone 16",
    browser: "Safari 18",
    ip_addr: "10.0.12.35",
    city: "Bangkok, TH",
    current: false,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    last_seen_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: "sess_52",
    device_label: "Windows · Chrome",
    browser: "Chrome 141",
    ip_addr: "203.144.92.18",
    city: "Chiang Mai, TH",
    current: false,
    created_at: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    last_seen_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
];

export const ORG_USER_FIELDS: OrgUserField[] = [
  {
    id: "fld_student_id",
    key: "student_id",
    label: "Student ID",
    type: "text",
    required: true,
    help_text: "Your university-issued ID (8 digits).",
    placeholder: "65010123",
    options: null,
    order: 0,
  },
  {
    id: "fld_faculty",
    key: "faculty",
    label: "Faculty",
    type: "select",
    required: true,
    help_text: null,
    placeholder: null,
    options: ["Engineering", "Science", "Arts", "Business", "Medicine", "Law"],
    order: 1,
  },
  {
    id: "fld_year",
    key: "year_of_study",
    label: "Year of study",
    type: "number",
    required: false,
    help_text: "Enter 1–6.",
    placeholder: "1",
    options: null,
    order: 2,
  },
  {
    id: "fld_phone",
    key: "phone",
    label: "Phone",
    type: "text",
    required: false,
    help_text: null,
    placeholder: "+66 81 234 5678",
    options: null,
    order: 3,
  },
];

export const USER_ATTRIBUTES: Record<string, UserAttributes> = {
  usr_000001: { student_id: "65010001", faculty: "Engineering", year_of_study: 4, phone: "+66 81 111 0001" },
  usr_000002: { student_id: "65010002", faculty: "Science", year_of_study: 3, phone: "+66 81 111 0002" },
  usr_000003: { student_id: "65010003", faculty: "Arts", year_of_study: null, phone: null },
};

export const ADMIN_SESSION_USER = {
  id: "usr_000001",
  display_name: "Akari K.",
  email: "akari.k@ubk.ac.th",
  role: "admin" as const,
  org_name: ORG.name,
  org_slug: ORG.slug,
};
