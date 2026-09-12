import { cookies } from "next/headers";
import { config } from "@/lib/config";
import * as doorApi from "@/lib/doors";
import { permissions, type Permissions } from "@/lib/permissions";
import * as sessions from "@/lib/sessions";
import type { Session, Verdict } from "@/lib/sessions";
import { openDoor, refreshTokens } from "./actions";

/**
 * One page, rendered on the server, with no client JavaScript.
 *
 * The panel draws the building, presses the doors, and reports what it was
 * told. What it never does is decide — there is no check anywhere in this file
 * of the form "does the session hold this scope, and if not grey the button
 * out". Every door is pressable by everybody, and the answer comes from the
 * controller on :5400.
 */

const Mark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="mark">
    <path d="M12 1.5l1.9 6.9 5.1-4.4-3.2 6.3 6.7-1.4-6 3.6 6 3.6-6.7-1.4 3.2 6.3-5.1-4.4L12 22.5l-1.9-6.9-5.1 4.4 3.2-6.3-6.7 1.4 6-3.6-6-3.6 6.7 1.4L4.9 4l5.1 4.4z" />
  </svg>
);

function Masthead() {
  const issuer = config.issuer.replace(/^https?:\/\//, "");
  return (
    <>
      <header className="masthead">
        <p className="eyebrow">
          <span className="dot" />
          IDEN sample · access control
        </p>
        <h1>Door Panel</h1>
        <p className="lede">
          Four floors, three doors, and one question that is not &ldquo;who are you?&rdquo;
        </p>
      </header>
      <p className="meta">
        <span>
          <b>:5401</b> this panel
        </span>
        <span>
          controller <b>:5400</b>
        </span>
        <span>
          client_id <b>{config.clientId}</b>
        </span>
        <span>
          issuer <b>{issuer}</b>
        </span>
      </p>
    </>
  );
}

/** The refusal, quoted rather than summarised. The status code is the lesson. */
function VerdictBanner({ verdict }: { verdict: Verdict }) {
  if (verdict.allowed) {
    return (
      <div className="verdict verdict--open">
        <strong>200 · Open</strong>
        {verdict.message}
      </div>
    );
  }

  const stepUp = verdict.acrValues !== undefined || verdict.maxAge !== undefined;
  const query = new URLSearchParams();
  if (verdict.acrValues) query.set("acr_values", verdict.acrValues);
  if (verdict.maxAge !== undefined) query.set("max_age", String(verdict.maxAge));

  return (
    <div className={`verdict ${stepUp ? "verdict--stepup" : "verdict--denied"}`}>
      <strong>
        {verdict.status} · {verdict.code}
      </strong>
      {verdict.message}

      {verdict.status === 403 && !stepUp && (
        <p className="verdict__note">
          <b>403, not 401.</b> The token is valid and signing in again produces exactly the
          same one. What is missing is a permission, and only an administrator can change
          that.
        </p>
      )}

      {stepUp && (
        <>
          <p className="verdict__note">
            The refusal carried <code>WWW-Authenticate</code> naming what would satisfy it.
            The panel does not have to understand second factors — it copies those parameters
            onto the next authorization request and IDEN handles the rest.
          </p>
          <a className="button" href={`/api/login?${query.toString()}`}>
            Prove it again
          </a>
        </>
      )}
    </div>
  );
}

function Doors({ doors, verdict }: { doors: doorApi.Door[]; verdict?: Verdict }) {
  return (
    <section className="card">
      <h2>The building</h2>
      <p>
        Every door is pressable. The panel has no idea which ones will open — that is the
        controller&rsquo;s call, and it makes it from the token alone.
      </p>

      <ul className="doors">
        {doors.map((door) => (
          <li key={door.id} className="door">
            <div className="door__head">
              <h3 className="door__name">{door.name}</h3>
              <code>{door.scope}</code>
            </div>
            <p className="door__blurb">{door.blurb}</p>

            {(door.acr || door.maxAge !== undefined) && (
              <p className="door__extra">
                Also demands{" "}
                {door.acr && (
                  <>
                    assurance <b>{door.acr}</b>
                  </>
                )}
                {door.acr && door.maxAge !== undefined && " and "}
                {door.maxAge !== undefined && (
                  <>
                    a sign-in within <b>{door.maxAge}s</b>
                  </>
                )}
                .
              </p>
            )}

            <form action={openDoor}>
              <input type="hidden" name="door" value={door.id} />
              <button className="button button--primary" type="submit">
                Open
              </button>
            </form>

            {verdict?.door === door.id && <VerdictBanner verdict={verdict} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What the token says, which is not what was asked for.
 *
 * The panel requests all three door scopes on every sign-in. Everything missing
 * from this list was pruned silently by IDEN because the person does not hold
 * it — no error, no failed sign-in, just a narrower token.
 */
function TokenCard({ session }: { session: Session }) {
  const authAge =
    session.authTime === undefined
      ? "—"
      : `${Math.max(0, Math.floor(Date.now() / 1000) - session.authTime)}s ago`;

  const rows: [string, string, boolean?][] = [
    ["sub", session.subject],
    ["scope", session.scope.join(" ") || "— none —"],
    ["acr", session.acr ?? "—", true],
    ["amr", session.amr.join(", ") || "—", true],
    ["auth_time", authAge, true],
  ];

  return (
    <section className="card">
      <div className="who">
        <span className="avatar" aria-hidden="true">
          {session.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="name">{session.name}</p>
          {session.email && <p className="email">{session.email}</p>}
        </div>
      </div>

      <dl className="claims">
        {rows.map(([key, value, star]) => (
          <div key={key} className={star ? "star" : undefined}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <p className="hint">
        The panel asked for all three door scopes. Anything absent from <b>scope</b> was
        dropped <em>silently</em> — IDEN grants the intersection of what was requested, what
        this client may request, and what this person holds, and narrowing a token is not an
        error.
      </p>

      <div className="actions">
        <form action={refreshTokens}>
          <button className="button" type="submit">
            Refresh this token
          </button>
        </form>
        <a className="button" href="/api/login">
          Sign in again
        </a>
      </div>

      <p className="hint">
        <b>These two are not the same, and the difference is the surprising part.</b> A
        refresh re-resolves permissions but may only ever <em>narrow</em> the grant it was
        issued from, so it is how a <em>revoked</em> role disappears. A permission you have
        just been <em>given</em> cannot arrive that way — RFC 6749 forbids a refresh
        returning more than was originally granted — so it takes a new authorization
        request. You will not be asked for a password: the IDEN session is still there.
      </p>
    </section>
  );
}

/** Where each permission came from — asked of IDEN, not of the door. */
function Provenance({ data }: { data: Permissions }) {
  return (
    <section className="card card--quiet">
      <h2>Why you hold what you hold</h2>
      <p>
        A token carries <code>scope</code> and nothing else — no roles, no groups. A resource
        server should not need an org chart to check a permission. A person looking at a
        locked door does want one, so IDEN answers that separately.
      </p>

      <dl className="claims">
        <div>
          <dt>groups</dt>
          <dd>{data.groups.join(", ") || "— none —"}</dd>
        </div>
        <div>
          <dt>roles</dt>
          <dd>{data.roles.join(", ") || "— none —"}</dd>
        </div>
      </dl>

      <ul className="sources">
        {data.scopes
          .filter((source) => source.value.startsWith("door:"))
          .map((source) => (
            <li key={source.value}>
              <code>{source.value}</code>
              <span>
                {/* A group entry already reads "Group → role", so it needs no
                    label of its own; the other two do. */}
                {source.viaGroups.length > 0
                  ? `via ${source.viaGroups.join(", ")}`
                  : source.viaRoles.length > 0
                    ? `via role ${source.viaRoles.join(", ")}`
                    : "granted to you directly"}
              </span>
            </li>
          ))}
      </ul>

      {data.scopes.every((source) => !source.value.startsWith("door:")) && (
        <p className="hint">
          You hold no door permissions at all. Somebody has to put you in a group or give you
          a role before any of this opens.
        </p>
      )}
    </section>
  );
}

function SignedOut() {
  return (
    <section className="card">
      <h2>Not signed in</h2>
      <p>
        This panel has no idea who you are, and no opinion about what you may open. Signing in
        hands the first question to IDEN; the second belongs to the door controller.
      </p>
      <form action="/api/login" method="get">
        <button className="button button--primary" type="submit">
          <Mark />
          Sign in with IDEN
        </button>
      </form>
    </section>
  );
}

function HowThisWorks({ audience }: { audience: string }) {
  return (
    <section className="card card--quiet">
      <h2>How this works</h2>
      <pre className="wire">{`  Panel :5401  ───Bearer token───►  Controller :5400
       │                                    │
       └──► IDEN                            │
            issues the token                │
            ◄─── public keys, fetched once ───┘`}</pre>
      <p>
        The controller never calls IDEN to ask about you. It fetched the public signing keys
        once and validates every token offline — no round trip, no shared database, and no
        outage here when the identity provider restarts.
      </p>
      <p>
        The price is honest: a permission revoked now keeps working until the token expires,
        ten minutes by default. For a door that is the right trade.
      </p>
      <p className="hint">
        Tokens for this API are addressed to <code>{audience}</code>. The controller checks
        that, and a token minted for anything else is refused even though IDEN signed it.
      </p>
    </section>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const store = await cookies();
  const session = sessions.get(store.get(sessions.COOKIE)?.value);

  let building: { audience: string; doors: doorApi.Door[] } | null = null;
  let controllerError: string | null = null;
  try {
    building = await doorApi.catalogue();
  } catch (problem) {
    controllerError = problem instanceof Error ? problem.message : String(problem);
  }

  const provenance = session ? await permissions(session) : null;

  return (
    <>
      <Masthead />

      {error && (
        <div className="verdict verdict--denied">
          <strong>Something went wrong</strong>
          {error}
        </div>
      )}

      {controllerError && (
        <div className="verdict verdict--denied">
          <strong>The door controller is not answering</strong>
          {controllerError} — is it running on {config.api}?
        </div>
      )}

      {!session && <SignedOut />}
      {session && <TokenCard session={session} />}
      {session && building && <Doors doors={building.doors} verdict={session.verdict} />}
      {session && provenance && <Provenance data={provenance} />}
      {building && <HowThisWorks audience={building.audience} />}

      {session && (
        <p className="strip">
          <a href="/api/logout">Sign out</a> — ends the IDEN session too, so the next sign-in
          starts from nothing.
        </p>
      )}
    </>
  );
}
