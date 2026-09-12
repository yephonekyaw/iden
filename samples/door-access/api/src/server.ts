import express, { type Request, type Response } from "express";
import { config } from "./config.js";
import { DOORS, doorById, type Door } from "./doors.js";
import { Refusal, discover, scopesOf, verifyAccessToken, type AccessClaims } from "./tokens.js";

/**
 * **The door controller. It decides, and nothing else does.**
 *
 * The panel on :5401 renders buttons and holds a session. It does not know
 * which doors you may open — it asks, and it is told. That separation is the
 * entire point of the sample, and it is worth stating why it matters rather
 * than only showing it: a client that decided for itself would be deciding
 * from data it received, which anybody holding the browser can change. A door
 * opens because *this* process read a signed token and did arithmetic.
 *
 * Everything here validates offline. This file imports a JWT library, an HTTP
 * server, and nothing else — no IDEN SDK, because there isn't one and there
 * does not need to be.
 */

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// The panel is a server and calls this from Node, so CORS is not needed for the
// sample as shipped. It is here for the reader who points a browser at it.
app.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

/**
 * What just happened, for the panel to render.
 *
 * A demo where the refusal is only an HTTP status is a demo nobody can follow
 * from across a room. Every attempt records the reason, and the reason is the
 * interesting half.
 */
export interface Attempt {
  at: string;
  door: string;
  subject: string;
  clientId: string;
  allowed: boolean;
  status: number;
  reason: string;
}

const log: Attempt[] = [];

function record(entry: Attempt): void {
  log.unshift(entry);
  log.length = Math.min(log.length, 20);
}

const ACR_ORDER = ["iden:loa:1", "iden:loa:2", "iden:loa:3"];

/** Levels are ordered, so loa3 satisfies a door asking for loa2. */
function meetsAcr(held: string | undefined, required: string): boolean {
  const have = held ? ACR_ORDER.indexOf(held) : -1;
  return have >= ACR_ORDER.indexOf(required);
}

/**
 * The decision, in one function, with nothing else in it.
 *
 * Read top to bottom it is the whole authorization model: do you hold the
 * permission, did you prove yourself strongly enough, and did you do it
 * recently enough. Three different questions with three different answers, and
 * collapsing any two of them loses information the caller needs to act on.
 */
function decide(door: Door, claims: AccessClaims): void {
  if (!scopesOf(claims).includes(door.scope)) {
    // 403, not 401. The token is perfectly valid and signing in again will
    // produce exactly the same one — what is missing is a permission, and only
    // an administrator can change that.
    throw new Refusal(403, "insufficient_scope", `This token does not carry ${door.scope}.`, {
      scope: door.scope,
    });
  }

  if (door.acr && !meetsAcr(claims.acr, door.acr)) {
    // RFC 9470. A client that understands this sends the person back through
    // /authorize with the parameter named here and retries, so the refusal is
    // an instruction rather than a dead end.
    throw new Refusal(
      403,
      "insufficient_user_authentication",
      `This door needs ${door.acr}; this session reached ${claims.acr ?? "no level at all"}.`,
      { acr_values: door.acr },
    );
  }

  if (door.maxAge !== undefined) {
    // `auth_time` is when they authenticated, not when the token was minted. In
    // an SSO session those differ by hours, which is the entire reason this
    // check reads the former.
    const authTime = claims.auth_time;
    if (authTime === undefined) {
      throw new Refusal(403, "insufficient_user_authentication", "No auth_time in this token.", {
        max_age: door.maxAge,
      });
    }

    const age = Math.floor(Date.now() / 1000) - authTime;
    if (age > door.maxAge) {
      throw new Refusal(
        403,
        "insufficient_user_authentication",
        `This door needs a sign-in within ${door.maxAge}s; this one was ${age}s ago.`,
        { max_age: door.maxAge },
      );
    }
  }
}

/** RFC 6750 Section 3. The header is how a client learns what to do next. */
function challenge(response: Response, refusal: Refusal): void {
  const parts = [
    `Bearer error="${refusal.code}"`,
    `error_description="${refusal.message.replaceAll('"', "'")}"`,
    ...Object.entries(refusal.params).map(([key, value]) =>
      typeof value === "number" ? `${key}=${value}` : `${key}="${value}"`,
    ),
  ];
  response.setHeader("WWW-Authenticate", parts.join(", "));
}

const bearer = (request: Request): string | null => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
};

// --------------------------------------------------------------------------

/**
 * The catalogue, unauthenticated on purpose.
 *
 * What a door *requires* is not a secret — it is printed on the sign next to
 * it. Keeping it open lets the panel draw the building before anybody has
 * signed in, which is how somebody reading the demo learns what they are
 * about to be refused.
 */
app.get("/doors", (_request, response) => {
  response.json({ audience: config.audience, doors: DOORS });
});

app.post("/doors/:id/open", async (request, response) => {
  const door = doorById(request.params.id);
  if (!door) return response.status(404).json({ error: "no_such_door" });

  // Filled in as they become known: a token that fails to verify never yields a
  // subject, and the attempt is still worth logging without one.
  let subject = "—";
  let clientId = "—";

  const refuse = (refusal: Refusal) => {
    // A 5xx is this service's fault, not the caller's, so it gets no challenge.
    if (refusal.status < 500) challenge(response, refusal);
    record({
      at: new Date().toISOString(),
      door: door.id,
      subject,
      clientId,
      allowed: false,
      status: refusal.status,
      reason: refusal.message,
    });
    console.log(`[deny]  ${door.id.padEnd(6)} ${refusal.status} ${refusal.message}`);
    return response
      .status(refusal.status)
      .json({ error: refusal.code, error_description: refusal.message });
  };

  const raw = bearer(request);
  if (!raw) return refuse(new Refusal(401, "invalid_token", "No bearer token."));

  let claims: AccessClaims;
  try {
    claims = await verifyAccessToken(raw);
  } catch (problem) {
    if (problem instanceof Refusal) return refuse(problem);
    // Discovery or the JWKS fetch failed. That is this service being unable to
    // answer, which is not the same as the caller being refused.
    return refuse(
      new Refusal(
        503,
        "server_error",
        problem instanceof Error ? problem.message : String(problem),
      ),
    );
  }

  subject = String(claims.sub ?? "—");
  clientId = String(claims.client_id ?? "—");

  try {
    decide(door, claims);
  } catch (problem) {
    return refuse(problem as Refusal);
  }

  record({
    at: new Date().toISOString(),
    door: door.id,
    subject,
    clientId,
    allowed: true,
    status: 200,
    reason: `Token carries ${door.scope}.`,
  });

  console.log(`[open]  ${door.id.padEnd(6)} sub=${subject} client=${clientId}`);
  response.json({ opened: true, door: door.id, scope: door.scope });
});

app.get("/log", (_request, response) => {
  response.json({ attempts: log });
});

app.get("/healthz", (_request, response) => {
  response.json({ ok: true });
});

// Discovery up front rather than on the first request: a misconfigured issuer
// should be a startup failure somebody sees, not a 503 on a door press.
discover()
  .then(({ jwks_uri }) => {
    app.listen(config.port, () => {
      console.log(`\n  Door controller`);
      console.log(`  http://localhost:${config.port}`);
      console.log(`  issuer          ${config.issuer}`);
      console.log(`  audience        ${config.audience}`);
      console.log(`  jwks            ${jwks_uri}`);
      console.log(`\n  Doors: ${DOORS.map((d) => `${d.id} (${d.scope})`).join(", ")}\n`);
    });
  })
  .catch((problem: unknown) => {
    console.error(`\n  Could not start: ${problem instanceof Error ? problem.message : problem}`);
    console.error(`  IDEN_ISSUER is ${config.issuer}. Is that right, and is it running?\n`);
    process.exit(1);
  });
