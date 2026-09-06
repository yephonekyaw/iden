import { config, SIBLING_ORIGIN } from "./config.js";
import type { Session } from "./sessions.js";

/**
 * Server-rendered HTML, deliberately.
 *
 * No build step and no framework: `pnpm install` then run. For a demo that has
 * to work on somebody else's laptop five minutes before it starts, that matters
 * more than anything a framework would buy. The styling is IDEN's tokens from
 * DESIGN.md, transcribed.
 */

const escape = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function shell(body: string, options: { poll?: boolean } = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(config.name)} · IDEN sample</title>
<link rel="stylesheet" href="/style.css">
<style>:root { --accent: ${config.accent}; }</style>
</head>
<body>
<main class="page">${body}</main>
${options.poll ? `<script src="/watch.js"></script>` : ""}
</body>
</html>`;
}

function header(): string {
  return `<header class="masthead">
  <p class="eyebrow"><span class="dot"></span>IDEN sample · single sign-out</p>
  <h1>${escape(config.name)}</h1>
  <p class="lede">${escape(config.tagline)}</p>
</header>`;
}

function siblingLink(): string {
  return `<p class="sibling">
  The other application is <a href="${SIBLING_ORIGIN}">${escape(config.sibling.name)}</a>,
  running separately on port ${config.sibling.port}. It shares nothing with this one
  except your browser and IDEN.
</p>`;
}

export function signedOut(options: { reason?: string | null; error?: string | null }): string {
  const reason = options.reason
    ? `<div class="banner banner--ended">
         <strong>You were signed out by ${escape(options.reason)}.</strong>
         Not by this application — a logout token arrived over the back channel and
         ended the session here. Nothing was clicked on this page.
       </div>`
    : "";

  const error = options.error
    ? `<div class="banner banner--error"><strong>Something went wrong.</strong> ${escape(
        options.error,
      )}</div>`
    : "";

  return shell(`${header()}
${reason}${error}
<section class="card">
  <h2>You are not signed in</h2>
  <p>This application has no idea who you are. Signing in hands that question to IDEN.</p>
  <a class="button button--primary" href="/login">
    <svg viewBox="0 0 24 24" aria-hidden="true" class="mark"><path d="M12 1.5l1.9 6.9 5.1-4.4-3.2 6.3 6.7-1.4-6 3.6 6 3.6-6.7-1.4 3.2 6.3-5.1-4.4L12 22.5l-1.9-6.9-5.1 4.4 3.2-6.3-6.7 1.4 6-3.6-6-3.6 6.7 1.4L4.9 4l5.1 4.4z"/></svg>
    Sign in with IDEN
  </a>
  <p class="hint">
    Already signed in over at ${escape(config.sibling.name)}? Use the link below and come
    back — you will not be asked for a password. That is single sign-on: one session,
    shared, with nothing passing between the two applications.
  </p>
</section>
${siblingLink()}`);
}

export function signedIn(session: Session): string {
  const rows: [string, string][] = [
    ["sub", session.subject],
    ["sid", session.sid ?? "— not issued —"],
    ["acr", session.acr ?? "—"],
    ["amr", session.amr.join(", ") || "—"],
    [
      "auth_time",
      session.authTime ? session.authTime.toLocaleTimeString() : "—",
    ],
    ["this app's session", session.id.slice(0, 12) + "…"],
  ];

  return shell(
    `${header()}
<section class="card card--in">
  <div class="who">
    <span class="avatar" aria-hidden="true">${escape(session.name.slice(0, 1).toUpperCase())}</span>
    <div>
      <p class="name">${escape(session.name)}</p>
      ${session.email ? `<p class="email">${escape(session.email)}</p>` : ""}
    </div>
    <span class="badge badge--live" id="live">session live</span>
  </div>

  <dl class="claims">
    ${rows
      .map(
        ([key, value]) =>
          `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`,
      )
      .join("")}
  </dl>

  <p class="hint">
    <strong>sid</strong> is the one that matters here. It is IDEN's name for your browser
    session, and it is what a logout token will use to find this session again and end it.
  </p>

  <div class="actions">
    <a class="button button--primary" href="/logout">Sign out everywhere</a>
    <a class="button" href="/logout?local=1">Sign out of this app only</a>
  </div>
</section>

<section class="card card--quiet">
  <h2>Try this</h2>
  <ol>
    <li>Open <a href="${SIBLING_ORIGIN}">${escape(config.sibling.name)}</a> and sign in —
      you will not be asked for anything.</li>
    <li>Put the two windows side by side.</li>
    <li>Press <em>Sign out everywhere</em> in either one.</li>
  </ol>
  <p>
    Both go to signed-out within a second or two. The one you did not touch was ended by a
    logout token IDEN posted to it directly, server to server — no iframes, no third-party
    cookies, nothing this page did.
  </p>
</section>
${siblingLink()}`,
    { poll: true },
  );
}

export function error(message: string): string {
  return shell(`${header()}
<div class="banner banner--error"><strong>Something went wrong.</strong> ${escape(message)}</div>
<section class="card">
  <a class="button" href="/">Start again</a>
</section>`);
}
