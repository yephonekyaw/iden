# Scopes

The permissions IDEN defines for itself. Everything here is marked system-defined and cannot be
renamed or deleted — an administrator who deleted `admin:roles:write` would lock the organization out
of its own deployment.

Your own APIs define their own permissions; see
[Validate tokens in your API](../guides/protect-an-api.md).

## Administration

Managing the deployment. The `administrator` role carries all of them.

| Scope | Grants |
|---|---|
| `admin:users:read` | View users, their roles, and their direct grants. |
| `admin:users:write` | Create, update, and delete users and their grants. |
| `admin:groups:read` | View groups, their members, and their roles. |
| `admin:groups:write` | Create, update, and delete groups and membership. |
| `admin:roles:read` | View roles and the scopes they bundle. |
| `admin:roles:write` | Create, update, and delete roles and their scopes. |
| `admin:apis:read` | View registered resource APIs. |
| `admin:apis:write` | Register, update, and delete resource APIs. |
| `admin:scopes:read` | View the scopes defined under an API. |
| `admin:scopes:write` | Define, update, and delete scopes under an API. |
| `admin:clients:read` | View registered OAuth clients. |
| `admin:clients:write` | Register clients and rotate their secrets. |
| `admin:audit:read` | Read the audit log. |
| `admin:profile-fields:read` | View the organization's profile schema. |
| `admin:profile-fields:write` | Define the fields this organization collects about people. |

## Self-service

What a person may do to their own account. The `member` role carries all of them.

| Scope | Grants |
|---|---|
| `entity:profile:read` | View your own profile. |
| `entity:profile:write` | Update your own profile. |
| `entity:credentials:write` | Change your own password. |
| `entity:totp:read` | View the status of your authenticator app. |
| `entity:totp:enroll` | Set up or remove your authenticator app. |
| `entity:sessions:read` | See where you are signed in. |
| `entity:sessions:revoke` | Sign yourself out of other sessions. |
| `entity:permissions:read` | See your own roles, groups, and permissions. |
| `entity:connections:read` | See which applications have access. |
| `entity:connections:revoke` | Withdraw an application's access. |

## Biometrics

Seeded only when `IDEN_BIOMETRIC_ENABLED=true`. The module itself is not built yet.

| Scope | Grants |
|---|---|
| `biometric:enroll` | Enrol a face template. |
| `biometric:verify` | Verify a face against a claimed identity. |
| `biometric:search` | Identify a face against all enrolled templates. |
| `biometric:liveness` | Check whether a captured face is live. |

## The OIDC scopes

Not IDEN's to define — these come from the specification and behave as clients expect.

| Scope | Effect |
|---|---|
| `openid` | Required to receive an ID token at all. Without it the flow is plain OAuth 2.0. |
| `profile` | Releases `name` and `preferred_username`. |
| `email` | Releases `email` and `email_verified`. |
| `offline_access` | Asks for a refresh token, so the application keeps working while the person is away from it. The client must also allow the `refresh_token` grant; without both, no refresh token is issued. |
