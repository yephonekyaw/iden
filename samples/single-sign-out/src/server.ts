import express, { type Request, type Response } from "express";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import * as oidc from "./oidc.js";
import * as sessions from "./sessions.js";
import { error, signedIn, signedOut } from "./views.js";

const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

const COOKIE = `${config.id}_session`;

/**
 * The pending half of one sign-in.
 *
 * `state`, `nonce` and the PKCE verifier have to survive the round trip to IDEN
 * and be checked when the browser comes back. In memory and keyed by `state`,
 * which is what makes the check meaningful: a response carrying a `state` this
 * process never issued is not a response to anything it asked for.
 */
const pending = new Map<string, { verifier: string; nonce: string }>();

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function setCookie(response: Response, value: string): void {
  response.setHeader(
    "Set-Cookie",
    // Lax rather than Strict: the browser arrives back here by top-level
    // navigation from IDEN, and Strict would withhold the cookie on exactly
    // that hop. `secure` is absent only because this demo runs on http.
    `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
  );
}

function clearCookie(response: Response): void {
  response.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

const current = (request: Request) => sessions.get(readCookie(request, COOKIE));

// --------------------------------------------------------------------------
// Pages
// --------------------------------------------------------------------------

app.get("/", (request, response) => {
  const session = current(request);

  if (session?.endedBy) {
    // Ended by IDEN while this browser was away. Say so once, then forget it.
    sessions.reap(session.id);
    clearCookie(response);
    return response.send(signedOut({ reason: session.endedBy, error: null }));
  }

  return response.send(
    session ? signedIn(session) : signedOut({ reason: null, error: null }),
  );
});

app.get("/login", async (_request, response) => {
  try {
    const { verifier, challenge } = oidc.pkce();
    const state = oidc.random();
    const nonce = oidc.random();
    pending.set(state, { verifier, nonce });

    response.redirect(await oidc.authorizeUrl({ state, nonce, challenge }));
  } catch (problem) {
    response.status(502).send(error(problem instanceof Error ? problem.message : String(problem)));
  }
});

app.get("/callback", async (request, response) => {
  const { code, state, error: failure, error_description: description } = request.query;

  if (typeof failure === "string") {
    return response.send(
      signedOut({ reason: null, error: `IDEN refused the request: ${description ?? failure}` }),
    );
  }

  if (typeof state !== "string" || !pending.has(state)) {
    return response
      .status(400)
      .send(error("The `state` does not match a request this application made."));
  }
  const attempt = pending.get(state)!;
  pending.delete(state);

  if (typeof code !== "string") {
    return response.status(400).send(error("No authorization code came back."));
  }

  try {
    const tokens = await oidc.exchange({ code, verifier: attempt.verifier });
    if (!tokens.id_token) {
      return response
        .status(400)
        .send(error("No ID token. Was `openid` in the requested scope?"));
    }

    const claims = await oidc.verifyIdToken(tokens.id_token, attempt.nonce);
    const sid = typeof claims.sid === "string" ? claims.sid : null;
    const session = sessions.create({ claims, tokens, sid });

    if (!sid) {
      console.warn(
        "[warn] The ID token carried no `sid`. Back-channel logout cannot find this " +
          "session, so single sign-out will not reach it.",
      );
    }

    setCookie(response, session.id);
    response.redirect("/");
  } catch (problem) {
    response.status(400).send(error(problem instanceof Error ? problem.message : String(problem)));
  }
});

/**
 * RP-initiated logout — OIDC RP-Initiated Logout 1.0.
 *
 * `?local=1` ends only this application's session and is here for contrast: do
 * that and the sibling stays signed in, which is what "sign out" means without
 * an identity provider behind it.
 */
app.get("/logout", async (request, response) => {
  const session = current(request);
  if (session) sessions.destroy(session.id);
  clearCookie(response);

  if (request.query.local === "1" || !session) return response.redirect("/");

  const url = await oidc.endSessionUrl(session.idToken);
  return response.redirect(url ?? "/");
});

// --------------------------------------------------------------------------
// The receiving end
// --------------------------------------------------------------------------

/**
 * Back-channel logout — OIDC Back-Channel Logout 1.0 §2.5.
 *
 * IDEN posts here server to server when a session this client was part of ends.
 * There is no browser involved, no cookie, and nothing to redirect: the only
 * thing that makes this request trustworthy is the signature on the token, so
 * verifying it properly is the whole job.
 *
 * The response must carry no cache headers and, per §2.8, a failure must not be
 * a redirect — the provider is a program reading a status code.
 */
app.post("/backchannel-logout", async (request, response) => {
  response.setHeader("Cache-Control", "no-store");

  const token = (request.body as Record<string, unknown> | undefined)?.logout_token;
  if (typeof token !== "string") {
    return response.status(400).json({ error: "invalid_request" });
  }

  try {
    const claims = await oidc.verifyLogoutToken(token);
    const ended = claims.sid ? sessions.destroyBySid(claims.sid, "IDEN") : 0;

    console.log(
      `[back-channel] logout token accepted · sid=${claims.sid ?? "—"} · ` +
        `sessions ended here: ${ended}`,
    );
    return response.status(200).end();
  } catch (problem) {
    const detail = problem instanceof Error ? problem.message : String(problem);
    console.error(`[back-channel] refused: ${detail}`);
    return response.status(400).json({ error: "invalid_request", error_description: detail });
  }
});

/**
 * What the open page polls.
 *
 * Without it a back-channel logout is invisible until somebody reloads, and the
 * demo's whole point is watching a window you are not touching sign itself out.
 */
app.get("/api/session", (request, response) => {
  const session = current(request);
  response.setHeader("Cache-Control", "no-store");

  if (!session) return response.json({ signedIn: false, endedBy: null });
  if (session.endedBy) {
    return response.json({ signedIn: false, endedBy: session.endedBy });
  }
  return response.json({ signedIn: true, endedBy: null, name: session.name });
});

app.listen(config.port, () => {
  console.log(`\n  ${config.name}`);
  console.log(`  ${config.origin}`);
  console.log(`  client_id       ${config.clientId}`);
  console.log(`  issuer          ${config.issuer}`);
  console.log(`  redirect_uri    ${config.redirectUri}`);
  console.log(`  back-channel    ${config.origin}/backchannel-logout`);
  console.log(
    `\n  Register that back-channel URI on the client as IDEN can reach it —\n` +
      `  from Docker that means host.docker.internal, not localhost. See the README.\n`,
  );
});
