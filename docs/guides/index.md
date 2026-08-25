# Guides

Task-shaped instructions. Each assumes you have read the [concepts](../concepts/index.md) it depends
on, and links back where it matters.

## Integrating an application

Start here if you are connecting something you built to IDEN.

1. **[Register your application](register-a-client.md)** — getting a `client_id`, and the choices
   that are hard to change later.
2. **[Using a standard OIDC library](oidc-libraries.md)** — the configuration for browser apps,
   server-rendered apps, mobile, and backends. Do not hand-roll the protocol.
3. **[Add a web application](web-application.md)** — the flow itself, step by step, if you want to
   see what the library is doing.
4. **[Add a machine client](machine-client.md)** — a backend acting as itself, no person involved.
5. **[Validate tokens in your API](protect-an-api.md)** — the other side, in any language.
6. **[Handle single sign-out](single-sign-out.md)** — so that signing out means something.
7. **[Troubleshooting](troubleshooting.md)** — symptom first, then what IDEN is telling you.

## Running and administering IDEN

- **[Run it locally](quickstart.md)** — a working deployment in about five minutes.
- **[Define your profile schema](profile-schema.md)** — the fields your organization collects.
