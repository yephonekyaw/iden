# Project IDEN — UI/UX Design Brief

**Version:** 0.1 · **Status:** For Design Review  
**Audience:** UI/UX Designer  
**Scope:** Auth UI, Dashboard SPA, Kiosk UI

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [Application Surfaces](#3-application-surfaces)
4. [Screen Inventory & Sitemap](#4-screen-inventory--sitemap)
5. [Design Direction & Aesthetic](#5-design-direction--aesthetic)
6. [Color System](#6-color-system)
7. [Typography](#7-typography)
8. [Spacing & Layout Grid](#8-spacing--layout-grid)
9. [Core Component Library](#9-core-component-library)
10. [States & Feedback Patterns](#10-states--feedback-patterns)
11. [Auth UI — Detailed Flows](#11-auth-ui--detailed-flows)
12. [Dashboard — Admin Flows](#12-dashboard--admin-flows)
13. [Dashboard — End-User Self-Service Flows](#13-dashboard--end-user-self-service-flows)
14. [Biometric UI Patterns](#14-biometric-ui-patterns)
15. [Kiosk UI Considerations](#15-kiosk-ui-considerations)
16. [Accessibility Requirements](#16-accessibility-requirements)
17. [Open Questions for the Designer](#17-open-questions-for-the-designer)

---

## 1. Product Overview

**IDEN** is an open-source **Identity Provider (IDP)** built on the OpenID Connect (OIDC) standard. It offers organizations a complete authentication platform with:

- Traditional **email + password** login
- **TOTP-based MFA** (time-based one-time passwords, e.g. Google Authenticator)
- **Facial biometric authentication** with liveness detection

IDEN is comparable in function to Auth0, Keycloak, or Okta — but open-source, self-hostable, and biometric-native.

### What IDEN does that others don't

The key differentiator is **first-class facial biometric authentication** integrated directly into the OIDC login flow. A user can authenticate purely by looking at a camera. A physical **kiosk device** (Raspberry Pi-based) can enroll and verify users biometrically without a keyboard.

### Authentication Assurance Levels

IDEN defines three assurance levels that third-party apps can request:

| Level | Meaning |
|---|---|
| `iden:loa:1` | Any single factor (password or face) |
| `iden:loa:2` | Two factors combined |
| `iden:loa:3` | Face (liveness-verified) + one more factor |

These levels are communicated to client apps via standard OIDC `acr` + `amr` claims in the ID token.

---

## 2. User Personas

IDEN has three distinct user types, each with a very different interaction mode.

---

### Persona A — The Platform Admin

**Who:** IT admin, developer, or DevOps engineer at the organization deploying IDEN.  
**Goal:** Manage the identity platform — create OIDC clients for apps, manage users, register kiosk devices, audit activity.  
**Technical level:** High. Comfortable with OAuth2/OIDC concepts, API keys, redirect URIs.  
**Context:** Desktop browser, good network, focused task.  
**Pain points:** Complex forms (OIDC client registration has ~20 fields), low tolerance for friction on power tasks.  
**Needs:** Data-dense views, fast filtering/search, good form UX for complex objects, clear danger zones for destructive actions.

---

### Persona B — The End User (Entity)

**Who:** Employee, member, or customer of the organization using IDEN for authentication.  
**Goal:** Manage their own account — change password, set up TOTP, enroll their face for biometric login, see login history.  
**Technical level:** Low to medium.  
**Context:** Desktop or mobile browser.  
**Pain points:** Confused by TOTP QR codes, anxious about biometric data, uncertain about account security status.  
**Needs:** Simple, reassuring language; step-by-step guided flows; clear visual feedback on enrollment status; explicit confirmation of what data is stored.

---

### Persona C — The Kiosk User

**Who:** Any person walking up to a physical kiosk (e.g. office entrance, building reception).  
**Goal:** Verify identity or enroll their face — done in seconds.  
**Technical level:** None required.  
**Context:** Standing in front of a physical device, possibly in a public/semi-public space, with no keyboard.  
**Pain points:** Uncertainty about where to look, poor lighting, no feedback on whether it's working.  
**Needs:** Giant visual affordances, real-time camera feedback, minimal text, forgiving error states, <5 second happy path.

---

## 3. Application Surfaces

IDEN has three distinct UI surfaces. Each has a different job, persona, and design character.

### Surface 1 — Auth UI `:4000`

**What it is:** The hosted login + consent UI. Every application that delegates authentication to IDEN redirects users here.  
**Character:** Focused, minimal, trustworthy. Like a bank login page — nothing to distract the user, strong security signaling.  
**Screens:** Login (with method picker), TOTP step-up, Biometric capture, Consent.  
**Brandability:** Should support theming by the deploying organization (logo, primary color override) — this is a future requirement but the component structure should allow for it.

---

### Surface 2 — Dashboard `:3000`

**What it is:** The main SPA — serves both admin (Persona A) and end-user (Persona B) depending on the logged-in user's role.  
**Character:** Product dashboard. Think Vercel, Railway, or Supabase — clean, modern, sidebar-nav, data-forward.  
**Two modes:**
- **Admin mode:** Data tables, forms, configuration panels — power-user density.
- **Entity mode:** Self-service account management — consumer-grade simplicity.

The same SPA detects the user's role via the access token scopes and shows the appropriate nav + sections.

---

### Surface 3 — Kiosk `:n/a`

**What it is:** A full-screen UI running on a Raspberry Pi-like device with a camera.  
**Character:** Ambient, touch-first, zero-cognitive-load. Like an ATM or a airport boarding gate scanner.  
**Status:** Design phase — implementation is planned for Phase 4.

---

## 4. Screen Inventory & Sitemap

### Auth UI — Screen Inventory

```
/auth/login
  ├── Method: Password (default)
  ├── Method: Biometric (face capture)
  └── Method: TOTP (step-up after initial login)

/auth/consent
  └── Scope grant approval screen
```

**Transition flow:** `/auth/login` (password) → `/auth/login` (TOTP step-up, if required) → `/auth/consent` → redirect back to client app.

---

### Dashboard — Screen Inventory

```
/ (root)
└── Redirect to /login or /dashboard depending on session

/login
└── Initiates OIDC flow to Auth UI (not a custom login page)

/dashboard (after authentication)
│
├── [Admin] /admin/clients
│   ├── List view — paginated table of OIDC clients
│   ├── Detail view — full client config
│   ├── Create flow — multi-step form
│   └── Edit view — patch mutable fields
│
├── [Admin] /admin/users
│   ├── List view — paginated table
│   ├── Detail view — user info, role, status, enrolled methods
│   └── Create / Deactivate actions
│
├── [Admin] /admin/kiosks
│   ├── List view — kiosk devices with status + last seen
│   ├── Detail view — device info, linked OIDC client
│   └── Register new kiosk flow
│
├── [Admin] /admin/scopes
│   └── Read-only catalog — all available scopes grouped by resource
│
├── [Entity] /profile
│   ├── View/edit display name, email
│   └── Profile photo (upload)
│
├── [Entity] /credentials
│   └── Change password form
│
├── [Entity] /totp
│   ├── Status: not enrolled / enrolled
│   ├── Enrollment flow — QR code display + verification step
│   └── Revoke TOTP
│
└── [Entity] /biometric (Phase 3)
    ├── Status: not enrolled / enrolled
    ├── Enrollment flow — camera capture
    └── Re-enroll / revoke
```

---

## 5. Design Direction & Aesthetic

### Core Aesthetic

**Modern security product.** The visual language should communicate: precision, trust, control, and cutting-edge capability. Reference points: **Vercel** (clean, dark-native, developer-forward), **1Password** (trustworthy, calm), **Linear** (dense but beautiful, smooth interactions).

### Tone

- **Not cold.** Security products often feel sterile. IDEN should feel precise but approachable.
- **Not playful.** This is authentication infrastructure. Bright gradients and gamified elements are wrong here.
- **Confident.** The biometric capability is genuinely novel. The design should reflect that without being flashy.

### Light vs. Dark

Recommend **dark mode as primary**, with a light mode available. Rationale:
- Admin users (DevOps/infra background) skew heavily dark-mode.
- The biometric camera UI looks significantly better on a dark background.
- Security tooling (Vault, Grafana, Datadog) normalizes dark.

Both modes must be designed — not just a color inversion.

### Personality Keywords

> Secure · Precise · Capable · Clean · Calm · Open

---

## 6. Color System

Design around a **semantic token system**, not raw hex values. Every component consumes tokens; raw colors only appear in the token definitions.

### Recommended Palette (to be validated by designer)

#### Base Neutrals (Dark Mode)

| Token | Role | Suggested value |
|---|---|---|
| `surface-base` | Page/app background | `#0a0a0f` |
| `surface-raised` | Cards, panels | `#111118` |
| `surface-overlay` | Modals, popovers | `#18181f` |
| `surface-sunken` | Input backgrounds | `#08080d` |
| `border-subtle` | Dividers, card outlines | `#1e1e28` |
| `border-default` | Input borders, separators | `#2a2a38` |
| `border-strong` | Focus rings, active states | `#4a4a65` |

#### Text

| Token | Role | Suggested value |
|---|---|---|
| `text-primary` | Main body text | `#e8e8f0` |
| `text-secondary` | Labels, captions, placeholders | `#8888a8` |
| `text-disabled` | Disabled state text | `#44445a` |
| `text-inverse` | Text on colored backgrounds | `#0a0a0f` |

#### Brand / Accent

| Token | Role | Suggested value |
|---|---|---|
| `accent-primary` | Primary actions, active nav, focus | `#6366f1` (indigo) |
| `accent-primary-hover` | Hover state | `#818cf8` |
| `accent-primary-muted` | Soft backgrounds for accent elements | `#6366f114` |

Indigo is recommended as the primary accent — it signals technology and security without the cliché of "security blue." It also differentiates from green (used for success) and doesn't clash with status colors.

#### Semantic Status Colors

| Token | Role | Suggested |
|---|---|---|
| `status-success` | Success states, enrolled | `#22c55e` |
| `status-success-muted` | Success chip backgrounds | `#22c55e14` |
| `status-warning` | Degraded, partial states | `#f59e0b` |
| `status-warning-muted` | Warning chip backgrounds | `#f59e0b14` |
| `status-danger` | Errors, destructive actions | `#ef4444` |
| `status-danger-muted` | Error chip backgrounds | `#ef4444` at 8% opacity |
| `status-info` | Informational states | `#38bdf8` |
| `status-info-muted` | Info chip backgrounds | `#38bdf814` |

#### Biometric-Specific Tokens

These are unique to the camera/scan UI and should feel distinct from the standard palette.

| Token | Role | Suggested |
|---|---|---|
| `bio-scanning` | Animated scan ring, active capture | `#6366f1` |
| `bio-success` | Match confirmed | `#22c55e` |
| `bio-failure` | No match / liveness fail | `#ef4444` |
| `bio-overlay` | Camera frame overlay background | `rgba(0,0,0,0.85)` |
| `bio-reticle` | Face detection guide shape | `#ffffff` at 60% opacity |

---

## 7. Typography

### Type Scale

Use a single typeface across all surfaces. Recommended: **Geist** (Vercel's open-source font — monospace variant available for code/IDs) or **Inter** as a safe fallback.

| Scale token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `display-lg` | 32px | 700 | 1.2 | Page titles |
| `display-sm` | 24px | 600 | 1.3 | Section headers |
| `heading-lg` | 20px | 600 | 1.4 | Card titles |
| `heading-sm` | 16px | 600 | 1.4 | Sub-sections, labels |
| `body-lg` | 16px | 400 | 1.6 | Default body copy |
| `body-sm` | 14px | 400 | 1.5 | Table cells, form labels |
| `caption` | 12px | 400 | 1.4 | Timestamps, meta info |
| `mono-sm` | 13px | 400 | 1.4 | Client IDs, tokens, secrets, code |
| `mono-lg` | 15px | 500 | 1.4 | TOTP codes, verification codes |

### Monospace Usage

All cryptographic identifiers must use the monospace variant:
- Client IDs (e.g. `iden_clt_8f3a...`)
- Client secrets (shown once on creation)
- TOTP secrets
- Scope names (e.g. `admin:clients:write`)
- Redirect URIs and other URL fields in detail views

---

## 8. Spacing & Layout Grid

### Spacing Scale

Base unit: **4px**. All spacing values are multiples.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Tight inline spacing |
| `space-2` | 8px | Icon-to-label gap, chip padding |
| `space-3` | 12px | Form field internal padding |
| `space-4` | 16px | Card padding, section gap |
| `space-5` | 20px | Form group gap |
| `space-6` | 24px | Card gap, section header margin |
| `space-8` | 32px | Page section spacing |
| `space-10` | 40px | Major section breaks |
| `space-12` | 48px | Page header spacing |

### Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  Topbar (56px)                                           │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ Sidebar  │  Main content area                            │
│ (220px)  │  max-width: 1200px, centered, padding: 32px   │
│          │                                               │
│          │                                               │
└──────────┴───────────────────────────────────────────────┘
```

- Sidebar: fixed left, collapses to icon-only on narrow viewports
- Content area: max-width 1200px, auto-centered with 32px horizontal padding
- Responsive breakpoints: 768px (tablet), 1024px (desktop), 1440px (wide)

### Auth UI Layout

Single-column centered card. No sidebar.

```
┌──────────────────────────────────────────────────────────┐
│  Background (full viewport, subtle texture or gradient)  │
│                                                          │
│           ┌──────────────────────┐                       │
│           │  IDEN logo           │                       │
│           │  Org logo (optional) │                       │
│           │                      │                       │
│           │  Login card          │                       │
│           │  (max-width: 420px)  │                       │
│           │                      │                       │
│           └──────────────────────┘                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Core Component Library

The following components must be designed. They form the atom-to-organism layer before any screens are designed.

### Atoms

#### Button

Four variants, consistent sizing across:

| Variant | Use |
|---|---|
| `primary` | Main CTA (Login, Save, Create) |
| `secondary` | Secondary actions (Cancel, Back) |
| `danger` | Destructive actions (Delete, Revoke) |
| `ghost` | Tertiary, inline actions |

Sizes: `sm` (32px height), `md` (40px), `lg` (48px — Auth UI primary action).  
States: default, hover, active, focus (visible ring), loading (spinner replaces label), disabled.

> **Important:** The danger button must have a visual pause — e.g. first click shows a confirmation inline or opens a confirm dialog. Never delete on a single click.

#### Input

- Text input, password input (with show/hide toggle), textarea
- States: default, focus, error (with inline message), disabled, read-only
- Special: URI input (shows a `link` icon prefix), email input, numeric input

#### Badge / Status Chip

Used heavily for: client status (active/disabled), user role (admin/user), kiosk status (active/inactive), authentication method tags (pwd, otp, face), scope resource grouping.

| Variant | Example values |
|---|---|
| `success` | active, enrolled, verified |
| `warning` | pending, degraded |
| `danger` | disabled, revoked, failed |
| `neutral` | kiosk, service, spa, web |
| `accent` | admin, biometric |

#### Toggle / Switch

For boolean settings: `require_pkce`, `consent_required`, `refresh_token_rotation`, `is_public`.  
Must show clear on/off label alongside the toggle — never rely on color alone.

#### Copy Button

Small inline button that copies a value to clipboard with a ✓ confirmation flash. Used for: client IDs, client secrets, TOTP secrets, scope names.

#### Skeleton Loader

Animated placeholder for loading states. Every data-fetching view must have a skeleton that matches the shape of the loaded content — no blank white panels.

---

### Molecules

#### Form Field Group

Label + input + helper text + error message. The standard unit for all forms. Label always visible (no placeholder-as-label pattern). Error text appears below in `status-danger` color.

#### URI List Editor

A specialized input for editing arrays of redirect URIs or post-logout URIs. Displays as a tagged list; add/remove individual URIs. Must validate each URI on entry (http/https only, no fragments).

#### Tag Input

For array fields that are not URIs: `allowed_scopes`, `audience`, `contacts`, `grant_types`. Select from a predefined list where possible (e.g. scopes from the scope catalog).

#### Detail Row

Used in detail/view panels:

```
Label          Value
─────────────────────────────
Client Kind    web  [badge]
Status         active  [badge]
Created        2025-03-12  14:32 UTC
```

#### Confirmation Dialog

Modal requiring explicit confirmation for irreversible actions. Must include:
- What will happen (specific, not generic)
- Input field requiring the user to type the resource name for high-stakes deletions
- Separate cancel and confirm buttons (confirm is danger-styled)

#### Secret Reveal Card

One-time display of a client secret or TOTP secret. Design requirements:
- Yellow/warning border — clearly signals "this is shown once"
- Full monospace display of the secret
- One-click copy button
- Explicit "I have saved this" checkbox before the user can dismiss
- Once dismissed, the card cannot be reopened — replaced by "secret not retrievable" message

#### Paginated Table

Standard data list with:
- Column headers with optional sort
- Loading skeleton (per-row skeletons, not full-page spinner)
- Empty state (distinct from zero-results: zero-results has a filter-related message, empty has a "create your first X" CTA)
- Row hover with quick actions on hover (view, edit, delete)
- Pagination controls (prev/next + page info "1–50 of 243")

---

### Organisms

#### Page Header

```
[Back arrow (if nested)]  Page Title        [Primary CTA button]
                          Subtitle / count
```

#### Sidebar Navigation

```
[IDEN Logo]
─────────────
[Admin section — only shown to admin role]
  Clients
  Users
  Kiosks
  Scopes
─────────────
[Entity section — shown to all]
  Profile
  Credentials
  TOTP
  Biometric (Phase 3)
─────────────
[Bottom]
  Settings
  [User avatar] Display Name
  Log out
```

Active item: `accent-primary` left border + text, `accent-primary-muted` background.

#### Topbar

```
[Hamburger (mobile)] [Breadcrumb]                    [Notifications] [User menu]
```

#### OIDC Client Card (list item)

```
┌───────────────────────────────────────────────┐
│  [Logo]  client_name                [active ▾]│
│          client_id (monospace, truncated)     │
│          web · 3 redirect URIs                │
│          Created Mar 12 2025         [→ View] │
└───────────────────────────────────────────────┘
```

---

## 10. States & Feedback Patterns

### Loading

- **Page-level:** Full skeleton layout matching the expected content shape
- **In-place:** Inline spinner inside buttons, with label changing to "Saving…"
- **Never:** Full-page spinner blocking the whole viewport

### Empty States

Each empty state must include:
- An illustration or icon (context-appropriate)
- A heading ("No clients registered yet")
- A short description line
- A primary CTA if the user can create ("Register your first OIDC client →")

Do not show the same generic empty state for every entity.

### Error States

Three tiers:

1. **Field-level error:** Inline, under the field. Short, specific. ("Must be a valid http/https URL.")
2. **Form-level error:** Banner at top of form for cross-field or server errors. ("Client with this name already exists.")
3. **Page-level error:** Full content area error with retry option. ("Failed to load clients — check your connection.")

### Success / Confirmation

- **Toast notifications** for non-blocking success: "Client created", "Secret rotated", "Settings saved"
- Toasts appear bottom-right, auto-dismiss after 4s, have an X to dismiss early
- **Inline confirmation** for sensitive actions: secret rotation success shows the Secret Reveal Card inline (not a toast)

### Destructive Action Pattern

For delete / revoke / rotate-secret actions:

1. User clicks "Delete client"
2. Inline confirmation appears (not a toast, not a modal) — "This will permanently delete `client_name`. All associated tokens will be invalidated."
3. Two buttons: "Cancel" and "Delete permanently" (danger style)
4. For high-stakes: require typing the client name before enabling the confirm button

---

## 11. Auth UI — Detailed Flows

The Auth UI lives at `/auth/*` and is the credential capture surface. It must feel secure, focused, and distraction-free.

### Login Page — Layout

```
┌─────────────────────────────────────┐
│  [Org logo, if configured]          │
│  [IDEN branding — small, secondary] │
│                                     │
│  Sign in to [Org Name]              │
│                                     │
│  ┌─ Method selector ─────────────┐  │
│  │ [Password] [Face] [More...]   │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Active method panel]              │
│                                     │
└─────────────────────────────────────┘
```

### Method Selector

A segmented control or tab strip at the top of the login card. Tabs:
- **Password** (default) — email + password fields
- **Face** — triggers camera capture
- **More** — overflow for TOTP-only scenarios (rare)

Method availability is controlled by the system; the UI should gracefully hide unavailable tabs.

### Password Panel

```
[Email address input]
[Password input + show/hide toggle]
[Remember this device — checkbox]
[Sign in — primary button, full width, large]
```

### TOTP Step-Up Panel

Shown after password succeeds, if the auth level requires a second factor.

```
Check your authenticator app

[6-digit code input — monospace, large, center-aligned]
[Verify — primary button]
[I don't have access to my authenticator → fallback flow]
```

The 6-digit input should be a single input that auto-formats and auto-submits on 6 characters. Large display size (`mono-lg` minimum). Auto-focus on mount.

### Face Capture Panel

This is the most unique surface. See Section 14 (Biometric UI Patterns) for full treatment.

### Consent Page

```
[App logo] is requesting access to your account

The following information will be shared:

  ✓ Your name and email (openid, profile, email)
  ✓ Read your OIDC clients (admin:clients:read)

[Allow — primary, full width]
[Deny — ghost or secondary]

Authorizing will redirect you to:
https://app.example.com/callback  (monospace, truncated)
```

Key design notes:
- Scope descriptions must be human-readable, not the raw scope string. The raw scope name should appear small/secondary.
- The redirect URI must be visible and legible — this is a security signal.
- Never auto-approve without user interaction. The Allow button must require a deliberate click.

---

## 12. Dashboard — Admin Flows

### OIDC Clients

#### List View

A card grid (not table) showing each client as a card (see OIDC Client Card in Components). Cards show: name, client_id (truncated, monospace), kind badge, status badge, created date.

Filters: search by name, filter by kind (web/spa/kiosk/service), filter by status.

Sort: by name (default), by created date.

#### Create Flow — Multi-Step Form

Client creation has ~20 fields. This **must be a multi-step form** — not a single long page.

Suggested steps:

1. **Basics** — client_name, description, client_kind, is_public, org_id
2. **Auth Config** — grant_types, response_types, token_endpoint_auth_method, require_pkce
3. **URIs** — redirect_uris, post_logout_redirect_uris, backchannel_logout_uri
4. **Scopes & Audience** — allowed_scopes (multi-select from catalog), audience
5. **Token Policy** — access_token_ttl_seconds, refresh_token_ttl_seconds, id_token_ttl_seconds, refresh_token_rotation
6. **Display Info** — logo_uri, client_uri, tos_uri, policy_uri, contacts
7. **Review & Create** — summary of all values, then Create button

Each step: "Back" and "Continue" nav, step indicator at top (1 of 7). The final Review step shows all values before committing.

On success, the Secret Reveal Card is shown inline before navigating to the detail view.

#### Detail View

Two-column layout:
- **Left:** Detail rows for all config fields (read mode by default, "Edit" button to enter edit mode)
- **Right:** Side panel with: Actions (Rotate Secret, Disable, Delete), Linked Kiosks (if kind=kiosk)

Tabs within detail: Overview · Security · URIs · Scopes · Token Policy

#### Secret Rotation

"Rotate Secret" button in the actions panel. On click: inline confirmation dialog, then Secret Reveal Card in place.

---

### Users (Admin)

#### List View

Paginated table with columns: Avatar + Name, Email, Role badge, Status badge, Created date, Actions.

Row quick actions: View detail, Deactivate/Activate, Reset password (future).

Filters: search by name/email, filter by role, filter by status.

#### Detail View

- User info: display name, email, role, status, created, last login
- Enrolled methods: shows which credentials the user has (password: yes/no, TOTP: enrolled/not, biometric: enrolled/not)
- org_attributes: show as key-value pairs defined by the org's claim definitions
- Audit log (paginated) for this user's actions

---

### Kiosk Devices (Admin)

#### List View

Table: Device Name, Hardware ID (monospace, truncated), Status badge, Linked Client, Last Seen (relative time), Created.

Status can be: active (green), inactive (grey), never connected (dim).

#### Register New Kiosk Flow

1. **Device Info** — name, hw_id (hardware identifier from the device)
2. **Link Client** — select from existing kiosk-kind OIDC clients (or create one)
3. **Confirm** — shows summary

After registration, show QR code or provisioning string that can be scanned by the kiosk device.

---

### Scopes Catalog (Admin, Read-Only)

No create/edit. Just a well-organized display.

Group scopes by resource:

```
ADMIN SCOPES
  admin:clients:read     List and view OIDC clients       [admin] [read]
  admin:clients:write    Create, update, delete clients   [admin] [write]
  admin:users:read       ...
  ...

ENTITY SCOPES
  entity:profile:read    ...
  ...

BIOMETRIC SCOPES
  biometric:enroll       ...
  biometric:verify       ...
```

Each row: scope name (monospace), description, resource badge, allowed-roles badges.

---

## 13. Dashboard — End-User Self-Service Flows

The entity section serves non-technical users. Language should be plain, flows should be guided.

### Profile Page

Simple form: display name, profile photo (upload with crop), email (read-only — email change is a future flow).

### Change Password

```
Current password
New password              [strength indicator]
Confirm new password

[Update password — primary button]
```

Inline password strength meter (weak/fair/strong/very strong).

### TOTP Setup

Three states, each with a distinct panel:

**State A — Not enrolled**
```
Two-factor authentication adds an extra layer of security.
Each sign-in will require a code from your authenticator app.

[Set up authenticator app → button]
```

**State B — Enrollment flow (step-by-step)**

Step 1:
```
Install an authenticator app

Google Authenticator, Authy, or 1Password work great.

[I already have one → Continue]
```

Step 2:
```
Scan this QR code with your authenticator app

[QR Code — large, high contrast]

Can't scan? Enter this code manually:
JBSWY3DPEHPK3PXP  [monospace, copyable, grouped for readability]

[I've scanned it → Continue]
```

Step 3 — Verification:
```
Enter the 6-digit code from your app to confirm setup

[Code input — large, monospace, auto-submit at 6 chars]

[Verify → primary button]
```

Step 4 — Success:
```
Two-factor authentication is now active ✓

Next time you sign in, you'll be asked for a code
after your password.
```

**State C — Enrolled**
```
Two-factor authentication is active ✓
Set up on March 12, 2025

[Remove authenticator app] ← danger style, with confirmation
```

### Biometric Enrollment (Phase 3)

See Section 14 for the camera capture UX. The enrollment flow within the Dashboard will be:

1. Permission/explanation screen — what data is stored, how to remove it
2. Camera capture flow (see §14)
3. Success confirmation

---

## 14. Biometric UI Patterns

The biometric camera interface is the most technically novel part of IDEN's UI. It needs careful treatment.

### Core Camera Component

**Full-screen modal** when active (camera takes over, no distractions). On mobile or kiosk: can be full-screen native.

Layout:
```
┌──────────────────────────────────────────────┐
│  [Close button — top right]                  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │          Camera feed                   │  │
│  │                                        │  │
│  │       ╭──────────────╮                 │  │
│  │       │              │                 │  │
│  │       │  Face oval   │                 │  │
│  │       │  reticle     │                 │  │
│  │       ╰──────────────╯                 │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Instruction text — centered, large]        │
│  "Look directly at the camera"               │
│                                              │
│  [Status indicator]                          │
│                                              │
└──────────────────────────────────────────────┘
```

### Reticle Behavior

The oval reticle should:
- Default: white, 60% opacity, dashed or soft border
- Face detected: solid, pulses gently (`bio-scanning` color) — "Scanning…"
- Liveness check: animated scan line sweeps top-to-bottom
- Match confirmed: fills green briefly (`bio-success`) → transition out
- No match / failure: flashes red (`bio-failure`), shakes slightly

These micro-animations are critical to the UX — they give the user real-time feedback on what's happening.

### Instructions

Text below the camera feed should update dynamically:
| State | Instruction text |
|---|---|
| Initializing | "Starting camera…" |
| Waiting | "Position your face in the oval" |
| Face detected | "Hold still…" |
| Liveness check | "Blink slowly" or "Turn your head slightly" |
| Processing | "Verifying…" |
| Success | "Identity confirmed" |
| Failure — no face | "No face detected. Make sure your face is well-lit." |
| Failure — liveness | "Liveness check failed. Please try again." |
| Failure — no match | "No match found." (authentication) |
| Error — camera | "Camera access denied. Please allow camera permissions." |

### Accessibility Note for Biometric

Biometric capture is inherently visual. Always provide:
- A fallback method selection ("Use password instead" — always visible)
- Screen reader announcements for state changes (ARIA live region)
- A text description of what's happening at each step

### Liveness Visual Cues

Liveness detection (confirming the user is a live person, not a photo) may include prompts. The UI must:
- Display the liveness prompt clearly and briefly
- Not expose *which* liveness checks are being done (security reason)
- Give feedback on failure without explaining the detection mechanism

---

## 15. Kiosk UI Considerations

The kiosk surface is physically embedded. Design rules that differ from the web surfaces:

### Physical Constraints

- Screen size: approximately 7–10 inch touchscreen (Raspberry Pi display)
- No keyboard, no mouse — touch only
- Users are standing up, arm's length from screen
- Ambient lighting varies (office, lobby, outdoor partial sun)

### Touch Target Sizes

Minimum touch target: **56px × 56px**. Prefer 72px for primary actions. No hover states.

### Typography

- Minimum body text: 18px
- Primary instruction text: 28–36px
- Numbers/codes: 48px monospace

### Interaction Model

The kiosk flow has two modes:

**Enrollment (one-time, guided)**
```
Step 1: Face the camera
Step 2: Hold still while we capture
Step 3: Done — your face has been registered
```

**Verification (repeated, fast)**
```
[Auto-start camera]
[Face detected — 2 second countdown]
[Result: welcome / access denied]
```

The verification flow should auto-start on presence detection (motion or proximity sensor). No button to press to begin — the user just walks up and looks.

### Idle State

A visually calm, low-power idle screen with a subtle animation inviting the user to approach. The org logo + "Look at the camera to sign in" (or similar).

### Error Handling on Kiosk

Errors must be very forgiving with clear recovery instructions. No technical jargon. Example:
- "Let's try again. Make sure the light is on your face." (not "Liveness detection failed with confidence 0.43")

---

## 16. Accessibility Requirements

IDEN must meet **WCAG 2.1 AA** across all surfaces.

### Color Contrast

- Normal text (< 18px / 14px bold): minimum 4.5:1 ratio against background
- Large text (≥ 18px / 14px bold): minimum 3:1
- UI components (inputs, buttons, active states): minimum 3:1

> Verify all proposed color tokens against these ratios. The dark surface palette proposed here should pass, but always measure.

### Focus Management

- All interactive elements must have a visible focus ring (never `outline: none` without a replacement)
- Focus should be trapped inside modals and confirmation dialogs
- After a modal closes, focus must return to the trigger element

### Keyboard Navigation

- Full keyboard operability: Tab, Shift+Tab, Enter, Space, Escape
- Multi-step forms: Escape should confirm cancel intent (not silently close)
- TOTP code input: single input, auto-submits at 6 digits, supports paste

### Screen Reader Support

- All form fields must have visible labels (not just placeholder text)
- All icons used as the only interactive affordance must have `aria-label`
- Status changes (save in progress, saved, error) must use ARIA live regions
- Biometric camera states must be announced (see §14)
- Tables must have proper `<th>` headers with `scope` attributes

### Motion

Respect `prefers-reduced-motion`. All non-critical animations (skeleton shimmers, scan line, reticle pulses) must be suppressible or replaced with static states.

---

## 17. Open Questions for the Designer

The following are genuine design decisions that need input from the designer — they are not resolved in this brief.

1. **Org branding in Auth UI:** How configurable should it be? Org logo slot only, or also primary color override? What's the fallback when no branding is set?

2. **Light vs dark mode default:** This brief recommends dark-primary. Does the designer have a different read? Light mode is especially important for kiosk (better camera contrast in some environments).

3. **Admin vs Entity navigation:** Should the dashboard show both admin + entity nav items in one sidebar (with a visual separator), or switch modes entirely (separate nav state)? A regular user should never see admin nav items.

4. **Mobile responsiveness of Dashboard:** The admin section is data-dense. How does the OIDC client create form (7 steps) work on mobile? Is mobile a priority for admin flows?

5. **Error state illustration style:** Line art, filled icons, or abstract shapes? The empty states and error states need a consistent visual style.

6. **Biometric camera modal depth:** Should the camera view be a full-screen overlay, an in-page panel, or a dedicated route? The answer may differ between auth-ui (dedicated page) and dashboard enrollment (modal or panel).

7. **Kiosk idle screen:** What kind of motion/ambient animation is appropriate for the idle state? This runs 24/7 on a physical screen — burn-in and power draw are concerns.

8. **Secret Reveal Card pattern:** The proposal uses an "I have saved this" checkbox to gate dismissal. Is there a better interaction model? Some products use a timed reveal instead.

9. **Logo and iconography style:** Should IDEN have a custom icon set, or use an existing library (Phosphor, Lucide, Radix Icons)? The biometric and identity metaphors (faces, keys, shields) need to be treated with care — avoid clichés.

10. **TOTP QR code context:** When displaying the QR code for TOTP enrollment, should we show the manual entry code in a more scannable format (grouped: `JBSW Y3DP EHPK 3PXP`)? What else should be visible alongside the QR code?

---

*This document is a living brief. Update it as design decisions are made and as the backend API surface expands (Entity module in Phase 2, Biometric module in Phase 3).*
