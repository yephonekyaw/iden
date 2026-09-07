import { auth, signIn, signOut } from "@/auth";

/**
 * One page, two states.
 *
 * `auth()` is Auth.js reading its own session cookie — this component never
 * sees a token, never calls IDEN, and contains nothing IDEN-specific. The
 * server actions below are the library's `signIn` and `signOut` verbatim.
 */
export default async function Home() {
  const session = await auth();

  return (
    <>
      <header className="masthead">
        <p className="eyebrow">
          <span className="dot" />
          IDEN sample · a library that never heard of IDEN
        </p>
        <h1>Next.js + Auth.js</h1>
        <p className="lede">
          Stock <code>next-auth</code> with its generic OIDC provider, pointed at IDEN. No
          adapter, no custom fetch, no patched endpoint — just an issuer and a client id.
        </p>
      </header>
      <p className="meta">
        <span>
          client_id <b>{process.env.IDEN_CLIENT_ID ?? "unset"}</b>
        </span>
        <span>
          issuer <b>{(process.env.IDEN_ISSUER ?? "unset").replace(/^https?:\/\//, "")}</b>
        </span>
      </p>

      {session?.user ? <SignedIn session={session} /> : <SignedOut />}

      <section className="card card--quiet">
        <h2>The whole integration</h2>
        <p>
          Everything connecting this application to IDEN is in <code>auth.ts</code>, and most
          of it is the two callbacks that carry claims through to this page so there is
          something to look at. The part that does the work is four lines: a type, an issuer,
          a client id and a secret.
        </p>
        <p>
          The endpoints are not written down anywhere. Auth.js reads them from{" "}
          <code>/.well-known/openid-configuration</code>, which is what discovery is for.
        </p>
      </section>
    </>
  );
}

function SignedOut() {
  return (
    <section className="card">
      <h2>You are not signed in</h2>
      <p>Auth.js will take you to IDEN and bring you back.</p>
      <form
        action={async () => {
          "use server";
          await signIn("iden", { redirectTo: "/" });
        }}
      >
        <button className="button button--primary" type="submit">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mark">
            <path d="M12 1.5l1.9 6.9 5.1-4.4-3.2 6.3 6.7-1.4-6 3.6 6 3.6-6.7-1.4 3.2 6.3-5.1-4.4L12 22.5l-1.9-6.9-5.1 4.4 3.2-6.3-6.7 1.4 6-3.6-6-3.6 6.7 1.4L4.9 4l5.1 4.4z" />
          </svg>
          Sign in with IDEN
        </button>
      </form>
    </section>
  );
}

interface IdenSession {
  user?: { name?: string | null; email?: string | null } | null;
  acr?: unknown;
  amr?: unknown;
  sid?: unknown;
  expires?: string;
}

function SignedIn({ session }: { session: IdenSession }) {
  // `acr` and `amr` carry the colour: they are how the person proved who they
  // were, and Auth.js surfaced them without knowing what they mean.
  const rows: [string, string, boolean?][] = [
    ["name", session.user?.name ?? "—"],
    ["email", session.user?.email ?? "—"],
    ["acr", typeof session.acr === "string" ? session.acr : "—", true],
    ["amr", Array.isArray(session.amr) ? session.amr.join(", ") : "—", true],
    ["sid", typeof session.sid === "string" ? session.sid : "— not requested —"],
    ["session expires", session.expires ? new Date(session.expires).toLocaleString() : "—"],
  ];

  return (
    <section className="card">
      <div className="who">
        <span className="avatar" aria-hidden="true">
          {(session.user?.name ?? session.user?.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="name">{session.user?.name ?? "Signed in"}</p>
          {session.user?.email ? <p className="email">{session.user.email}</p> : null}
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
        These claims came out of the ID token Auth.js verified against IDEN&rsquo;s published
        keys. It checked the signature, the issuer, the audience and the nonce without being
        told how — all of that is in the metadata.
      </p>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="button" type="submit">
          Sign out
        </button>
      </form>

      <p className="hint">
        This ends the <em>Auth.js</em> session only. Your IDEN session is still live, so
        signing in again will not ask for a password. Ending that one everywhere is what{" "}
        <a href="../single-sign-out">the single sign-out sample</a> is about.
      </p>
    </section>
  );
}
