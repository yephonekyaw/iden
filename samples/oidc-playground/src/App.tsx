import { useEffect, useMemo, useState } from "react";
import {
  authorizeUrl,
  challengeFor,
  decodeJwt,
  discover,
  exchangeCode,
  introspect,
  randomState,
  randomVerifier,
  refresh,
  revoke,
  secondsUntil,
  userinfo,
  verify,
  type Called,
  type Discovery,
  type Exchange,
} from "./lib/oidc";
import { useAttempt, useConfig, useDiscovery, type Config } from "./lib/store";
import {
  Badge,
  Button,
  Check,
  Code,
  Field,
  Input,
  Json,
  Mark,
  Note,
  Rows,
  Select,
  Stage,
  Toggle,
  cn,
} from "./ui";

export function App() {
  return window.location.pathname === "/callback" ? <Callback /> : <Playground />;
}

/**
 * The redirect lands here.
 *
 * It does nothing but capture the query string and hand it back to the main
 * page. Reading the parameters and *then* navigating means the code never sits
 * in the address bar of a page anyone might reload — an authorization code is
 * single use, and a reload spends it.
 */
function Callback() {
  useEffect(() => {
    const params = Object.fromEntries(new URLSearchParams(window.location.search));
    try {
      const raw = window.sessionStorage.getItem("iden.playground.attempt");
      const attempt = raw ? (JSON.parse(raw) as object) : {};
      window.sessionStorage.setItem(
        "iden.playground.attempt",
        JSON.stringify({ ...attempt, callback: params }),
      );
    } catch {
      // Storage is blocked. Nothing to recover to; the main page will say so.
    }
    window.location.replace("/");
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <p className="text-body-sm text-muted">Returning to the playground…</p>
    </main>
  );
}

function Playground() {
  const { config, update, reset } = useConfig();
  const { discovery, save } = useDiscovery();
  const { attempt, update: setAttempt, clear } = useAttempt();

  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(name: string, work: () => Promise<void>) {
    setBusy(name);
    setProblem(null);
    try {
      await work();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <header className="mb-10 border-[3px] border-ink bg-primary p-6 shadow-drop sm:p-8">
        <p className="font-identity inline-flex items-center gap-2 bg-ink px-2.5 py-1 text-caption-upper text-canvas uppercase">
          <Mark className="h-3 w-3" />
          IDEN sample
        </p>
        <h1 className="mt-4 text-display-lg text-ink">OIDC Playground</h1>
        <p className="mt-3 max-w-prose text-body-md font-medium text-ink">
          Build an authorization request one parameter at a time, run it against your IDEN
          deployment, and read everything that comes back. Nothing here is hidden by a client
          library — every request on this page is a <code className="font-identity">fetch</code> you
          can copy.
        </p>
      </header>

      {problem ? (
        <div className="mb-8">
          <Code label="Something went wrong" value={problem} tone="error" />
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <ProviderStage
          config={config}
          update={update}
          discovery={discovery}
          busy={busy === "discover"}
          onDiscover={() =>
            run("discover", async () => {
              save(await discover(config.issuer));
            })
          }
          onForget={() => save(null)}
        />

        <ClientStage config={config} update={update} enabled={Boolean(discovery)} />

        <RequestStage
          config={config}
          update={update}
          discovery={discovery}
          attempt={attempt}
          setAttempt={setAttempt}
          onReset={() => {
            clear();
            reset();
          }}
        />

        <CallbackStage config={config} attempt={attempt} onClear={clear} />

        <ExchangeStage
          config={config}
          discovery={discovery}
          attempt={attempt}
          busy={busy === "exchange"}
          onExchange={() =>
            run("exchange", async () => {
              if (!discovery || !attempt.callback?.code) return;
              const result = await exchangeCode({
                tokenEndpoint: discovery.token_endpoint,
                code: attempt.callback.code,
                redirectUri: config.redirectUri,
                clientId: config.clientId,
                codeVerifier: attempt.codeVerifier ?? "",
                clientSecret: config.clientSecret || undefined,
              });
              setAttempt({ exchange: result, tokens: result.body });
            })
          }
        />

        <TokensStage discovery={discovery} attempt={attempt} />

        <UseStage
          config={config}
          discovery={discovery}
          attempt={attempt}
          setAttempt={setAttempt}
          run={run}
          busy={busy}
        />
      </div>

      <footer className="mt-16 border-t-[3px] border-ink pt-6 text-caption text-muted">
        A sample application for <span className="font-identity text-body-strong">IDEN</span>.
        Everything it stores lives in this browser: the configuration in localStorage, the
        single-use secrets of one attempt in sessionStorage.
      </footer>
    </div>
  );
}

// --------------------------------------------------------------------------
// 1 · Provider
// --------------------------------------------------------------------------

function ProviderStage({
  config,
  update,
  discovery,
  busy,
  onDiscover,
  onForget,
}: {
  config: Config;
  update: (patch: Partial<Config>) => void;
  discovery: Discovery | null;
  busy: boolean;
  onDiscover: () => void;
  onForget: () => void;
}) {
  return (
    <Stage
      step={1}
      title="The provider"
      lede="Discovery is how a client learns every endpoint from one URL, so nothing below is hardcoded."
      done={Boolean(discovery)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field
          label="Issuer"
          className="flex-1"
          hint="The base URL. Must match the `iss` in issued tokens exactly."
        >
          {(props) => (
            <Input
              {...props}
              className="font-identity"
              value={config.issuer}
              onChange={(event) => update({ issuer: event.target.value })}
            />
          )}
        </Field>
        <Button variant="primary" onClick={onDiscover} disabled={busy}>
          {busy ? "Fetching…" : discovery ? "Re-discover" : "Discover"}
        </Button>
      </div>

      {discovery ? (
        <div className="mt-6 flex flex-col gap-4">
          <Rows
            entries={[
              ["authorization_endpoint", <Mono key="a">{discovery.authorization_endpoint}</Mono>],
              ["token_endpoint", <Mono key="t">{discovery.token_endpoint}</Mono>],
              ["userinfo_endpoint", <Mono key="u">{discovery.userinfo_endpoint}</Mono>],
              ["jwks_uri", <Mono key="j">{discovery.jwks_uri}</Mono>],
              [
                "code_challenge_methods_supported",
                <Mono key="p">
                  {(discovery.code_challenge_methods_supported ?? []).join(", ") || "—"}
                </Mono>,
              ],
              [
                "authorization_response_iss_parameter_supported",
                discovery.authorization_response_iss_parameter_supported ? (
                  <Badge key="i" tone="success">
                    true — RFC 9207
                  </Badge>
                ) : (
                  <Mono key="i">false</Mono>
                ),
              ],
            ]}
          />
          <details className="border-[3px] border-ink bg-canvas">
            <summary className="cursor-pointer px-4 py-3 text-body-sm text-body-strong">
              The whole metadata document
            </summary>
            <div className="p-3 pt-0">
              <Json value={discovery} />
            </div>
          </details>
          <Button size="sm" variant="ghost" className="self-start" onClick={onForget}>
            Forget it
          </Button>
        </div>
      ) : (
        <Note>
          Nothing else on this page works until discovery succeeds. If it fails with a network
          error, the provider is probably not allowing this origin — add{" "}
          <span className="font-identity">{window.location.origin}</span> to its CORS allowlist.
        </Note>
      )}
    </Stage>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-identity break-all text-caption text-body">{children}</span>;
}

// --------------------------------------------------------------------------
// 2 · Client
// --------------------------------------------------------------------------

function ClientStage({
  config,
  update,
  enabled,
}: {
  config: Config;
  update: (patch: Partial<Config>) => void;
  enabled: boolean;
}) {
  return (
    <Stage
      step={2}
      title="This client"
      lede="Register these in IDEN first — the redirect URI is matched exactly, with no wildcards and no forgiveness for a trailing slash."
      disabled={!enabled}
      done={enabled && Boolean(config.clientId)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="client_id" hint="What this application sends at /authorize and /token.">
          {(props) => (
            <Input
              {...props}
              className="font-identity"
              value={config.clientId}
              onChange={(event) => update({ clientId: event.target.value })}
            />
          )}
        </Field>
        <Field label="redirect_uri" hint="Register this exact string on the client.">
          {(props) => (
            <Input
              {...props}
              className="font-identity"
              value={config.redirectUri}
              onChange={(event) => update({ redirectUri: event.target.value })}
            />
          )}
        </Field>
        <Field
          label="client_secret"
          className="sm:col-span-2"
          hint="Leave empty for a public client, which is what a browser app is. Filling it in here would put a secret in a page anyone can read — it exists only so you can try the confidential flows against a throwaway client."
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              className="font-identity"
              placeholder="(public client — no secret)"
              value={config.clientSecret}
              onChange={(event) => update({ clientSecret: event.target.value })}
            />
          )}
        </Field>
      </div>
    </Stage>
  );
}

// --------------------------------------------------------------------------
// 3 · The request
// --------------------------------------------------------------------------

function RequestStage({
  config,
  update,
  discovery,
  attempt,
  setAttempt,
  onReset,
}: {
  config: Config;
  update: (patch: Partial<Config>) => void;
  discovery: Discovery | null;
  attempt: ReturnType<typeof useAttempt>["attempt"];
  setAttempt: (patch: Partial<ReturnType<typeof useAttempt>["attempt"]>) => void;
  onReset: () => void;
}) {
  const [preview, setPreview] = useState<string>("");

  // Rebuilt on every change so the URL is never stale against the form above
  // it — the point of this stage is watching it assemble.
  useEffect(() => {
    if (!discovery) return setPreview("");
    let cancelled = false;

    void (async () => {
      const verifier = attempt.codeVerifier ?? randomVerifier();
      const challenge = config.usePkce ? await challengeFor(verifier) : undefined;
      if (cancelled) return;

      setPreview(
        authorizeUrl(discovery.authorization_endpoint, {
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: config.responseType,
          scope: config.scope,
          state: config.useState ? (attempt.state ?? "…") : undefined,
          nonce: config.useNonce ? (attempt.nonce ?? "…") : undefined,
          code_challenge: challenge,
          code_challenge_method: challenge ? "S256" : undefined,
          prompt: config.prompt || undefined,
          acr_values: config.acrValues || undefined,
          max_age: config.maxAge || undefined,
          login_hint: config.loginHint || undefined,
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [config, discovery, attempt.codeVerifier, attempt.state, attempt.nonce]);

  async function go() {
    if (!discovery) return;

    // Minted here rather than at render, so what is stored is exactly what is
    // sent. `state` and `nonce` are checked against the response later, which
    // is the only reason to keep them.
    const verifier = randomVerifier();
    const challenge = config.usePkce ? await challengeFor(verifier) : undefined;
    const state = config.useState ? randomState() : undefined;
    const nonce = config.useNonce ? randomState() : undefined;

    const url = authorizeUrl(discovery.authorization_endpoint, {
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: config.responseType,
      scope: config.scope,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: challenge ? "S256" : undefined,
      prompt: config.prompt || undefined,
      acr_values: config.acrValues || undefined,
      max_age: config.maxAge || undefined,
      login_hint: config.loginHint || undefined,
    });

    setAttempt({
      codeVerifier: config.usePkce ? verifier : undefined,
      codeChallenge: challenge,
      state,
      nonce,
      authorizeUrl: url,
      callback: undefined,
      exchange: undefined,
      tokens: undefined,
    });

    // Deliberately a full navigation rather than a popup: this is what a real
    // client does, and it means the session cookie and the consent screen
    // behave exactly as they would in production.
    window.location.assign(url);
  }

  const scopes = config.scope.split(" ").filter(Boolean);

  return (
    <Stage
      step={3}
      title="The authorization request"
      lede="Every parameter below goes into one URL. Watch it assemble."
      disabled={!discovery}
    >
      <div className="flex flex-col gap-6">
        <Field
          label="scope"
          hint={
            <>
              Space-delimited. <span className="font-identity">openid</span> is what makes this OIDC
              rather than plain OAuth; <span className="font-identity">offline_access</span> is what
              asks for a refresh token.
            </>
          }
        >
          {(props) => (
            <Input
              {...props}
              className="font-identity"
              value={config.scope}
              onChange={(event) => update({ scope: event.target.value })}
            />
          )}
        </Field>

        {discovery?.scopes_supported?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {discovery.scopes_supported.slice(0, 40).map((value) => {
              const on = scopes.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    update({
                      scope: (on ? scopes.filter((s) => s !== value) : [...scopes, value]).join(
                        " ",
                      ),
                    })
                  }
                  className={cn(
                    "font-identity border-2 border-ink px-2.5 py-1 text-caption font-bold uppercase",
                    "transition-colors duration-75",
                    on
                      ? "bg-primary text-on-primary"
                      : "bg-canvas text-muted hover:bg-warning hover:text-ink",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="prompt" hint="`none` checks for a session without showing anything.">
            {(props) => (
              <Select
                {...props}
                value={config.prompt}
                onChange={(event) => update({ prompt: event.target.value })}
              >
                <option value="">(not sent)</option>
                <option value="none">none</option>
                <option value="login">login</option>
                <option value="consent">consent</option>
                <option value="select_account">select_account</option>
              </Select>
            )}
          </Field>

          <Field label="acr_values" hint="Demand an assurance level.">
            {(props) => (
              <Select
                {...props}
                value={config.acrValues}
                onChange={(event) => update({ acrValues: event.target.value })}
              >
                <option value="">(not sent)</option>
                {(discovery?.acr_values_supported ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="max_age" hint="Seconds. `0` means authenticate now.">
            {(props) => (
              <Input
                {...props}
                inputMode="numeric"
                placeholder="(not sent)"
                className="font-identity"
                value={config.maxAge}
                onChange={(event) => update({ maxAge: event.target.value })}
              />
            )}
          </Field>

          <Field label="login_hint" hint="Prefills the address on the sign-in form.">
            {(props) => (
              <Input
                {...props}
                placeholder="(not sent)"
                className="font-identity"
                value={config.loginHint}
                onChange={(event) => update({ loginHint: event.target.value })}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-3 border-t-[3px] border-ink pt-5">
          <Toggle
            checked={config.usePkce}
            onChange={(value) => update({ usePkce: value })}
            label="Use PKCE (S256)"
            hint="IDEN requires it of every client, public and confidential. Turn it off to watch the request be refused."
          />
          <Toggle
            checked={config.useState}
            onChange={(value) => update({ useState: value })}
            label="Send state"
            hint="Echoed back untouched. Checking it is what ties the response to this request."
          />
          <Toggle
            checked={config.useNonce}
            onChange={(value) => update({ useNonce: value })}
            label="Send nonce"
            hint="Lands in the ID token. Checking it is what stops one being replayed."
          />
        </div>

        {preview ? <Code label="GET" value={preview} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void go()} disabled={!discovery}>
            <Mark className="h-4 w-4" />
            Login with IDEN
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset everything
          </Button>
        </div>
      </div>
    </Stage>
  );
}

// --------------------------------------------------------------------------
// 4 · The callback
// --------------------------------------------------------------------------

function CallbackStage({
  config,
  attempt,
  onClear,
}: {
  config: Config;
  attempt: ReturnType<typeof useAttempt>["attempt"];
  onClear: () => void;
}) {
  const callback = attempt.callback;

  if (!callback) {
    return (
      <Stage step={4} title="What came back" disabled>
        <p className="text-body-sm text-muted">
          Run the request above and IDEN will send the browser back here.
        </p>
      </Stage>
    );
  }

  const failed = Boolean(callback.error);

  return (
    <Stage
      step={4}
      title="What came back"
      lede="The raw query string, before anything is done with it."
      done={!failed}
    >
      <div className="flex flex-col gap-5">
        <Rows
          entries={Object.entries(callback).map(([key, value]) => [
            key,
            <span key={key} className="font-identity break-all text-caption text-body">
              {value}
            </span>,
          ])}
        />

        {failed ? (
          <Note>
            IDEN refused the request and said why in <span className="font-identity">error</span>.
            That is the correct behaviour for anything it can safely tell the client — the errors it
            will not redirect are the ones about `client_id` and `redirect_uri`, because before
            those are validated the URI is unverified.
          </Note>
        ) : null}

        <div>
          <h3 className="mb-2 text-title-sm text-ink">Checks the client must do</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <Check ok={!config.useState || callback.state === attempt.state}>
              <span className="font-identity">state</span> matches what was sent
              {config.useState ? "" : " — not sent, so nothing to check"}
            </Check>
            <Check ok={!callback.iss || callback.iss === config.issuer.replace(/\/$/, "")}>
              <span className="font-identity">iss</span> names the provider that was asked
              {callback.iss ? " (RFC 9207)" : " — not returned"}
            </Check>
            <Check ok={Boolean(callback.code) || failed}>An authorization code is present</Check>
          </ul>
        </div>

        <Button size="sm" variant="ghost" className="self-start" onClick={onClear}>
          Clear this attempt
        </Button>
      </div>
    </Stage>
  );
}

// --------------------------------------------------------------------------
// 5 · The exchange
// --------------------------------------------------------------------------

function ExchangeStage({
  config,
  discovery,
  attempt,
  busy,
  onExchange,
}: {
  config: Config;
  discovery: Discovery | null;
  attempt: ReturnType<typeof useAttempt>["attempt"];
  busy: boolean;
  onExchange: () => void;
}) {
  const ready = Boolean(discovery && attempt.callback?.code);

  return (
    <Stage
      step={5}
      title="Exchanging the code"
      lede="A back-channel POST. The code is single use, and PKCE means it is worthless without the verifier this browser has been holding."
      disabled={!ready}
      done={Boolean(attempt.exchange && attempt.exchange.status === 200)}
    >
      {ready ? (
        <div className="flex flex-col gap-5">
          {config.usePkce ? (
            <Rows
              entries={[
                [
                  "code_verifier",
                  <span key="v" className="font-identity break-all text-caption text-body">
                    {attempt.codeVerifier}
                  </span>,
                ],
                [
                  "code_challenge sent",
                  <span key="c" className="font-identity break-all text-caption text-body">
                    {attempt.codeChallenge}
                  </span>,
                ],
              ]}
            />
          ) : null}

          <Button variant="primary" className="self-start" onClick={onExchange} disabled={busy}>
            {busy ? "Exchanging…" : "POST to /token"}
          </Button>

          {attempt.exchange ? (
            <>
              <Code
                label={`POST ${attempt.exchange.request.url}`}
                value={new URLSearchParams(attempt.exchange.request.body)
                  .toString()
                  .replaceAll("&", "\n&")}
              />
              <Json label={`${attempt.exchange.status} response`} value={attempt.exchange.body} />
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-body-sm text-muted">Needs an authorization code from the step above.</p>
      )}
    </Stage>
  );
}

// --------------------------------------------------------------------------
// 6 · The tokens
// --------------------------------------------------------------------------

function TokensStage({
  discovery,
  attempt,
}: {
  discovery: Discovery | null;
  attempt: ReturnType<typeof useAttempt>["attempt"];
}) {
  const tokens = attempt.tokens;
  const present = tokens?.access_token || tokens?.id_token;

  return (
    <Stage
      step={6}
      title="What you were given"
      lede="Decoding a JWT proves nothing — anyone can. Verifying the signature against the published keys is the other half, and it needs no call back to the provider."
      disabled={!present}
      done={Boolean(present)}
    >
      {present ? (
        <div className="flex flex-col gap-8">
          {tokens?.access_token ? (
            <TokenCard
              name="Access token"
              note="Addressed to an API. Check `aud` and `scope`; the header says `at+jwt` so it cannot be confused with an ID token."
              token={tokens.access_token}
              jwksUri={discovery?.jwks_uri}
            />
          ) : null}
          {tokens?.id_token ? (
            <TokenCard
              name="ID token"
              note="Addressed to this application, describing the sign-in event. Never send it to an API."
              token={tokens.id_token}
              jwksUri={discovery?.jwks_uri}
              expectNonce={attempt.nonce}
            />
          ) : null}
          {tokens?.refresh_token ? (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-title-sm text-ink">
                Refresh token <Badge tone="neutral">opaque</Badge>
              </h3>
              <p className="mb-3 max-w-prose text-body-sm text-muted">
                Not a JWT — a random string, meaningless outside IDEN. Every use rotates it, and
                presenting a spent one revokes the whole family.
              </p>
              <Code label="refresh_token" value={tokens.refresh_token} />
            </div>
          ) : (
            <Note>
              No refresh token. IDEN issues one only when{" "}
              <span className="font-identity">offline_access</span> was granted and the client
              allows the <span className="font-identity">refresh_token</span> grant — the grant is
              what the client may do, the scope is what this request asked for.
            </Note>
          )}
        </div>
      ) : (
        <p className="text-body-sm text-muted">Nothing yet.</p>
      )}
    </Stage>
  );
}

function TokenCard({
  name,
  note,
  token,
  jwksUri,
  expectNonce,
}: {
  name: string;
  note: string;
  token: string;
  jwksUri?: string;
  expectNonce?: string;
}) {
  const decoded = useMemo(() => decodeJwt(token), [token]);
  const [checked, setChecked] = useState<{ ok: boolean; detail: string } | null>(null);

  const expires = secondsUntil(decoded?.payload.exp);

  return (
    <div>
      <h3 className="mb-2 flex flex-wrap items-center gap-2 text-title-sm text-ink">
        {name}
        {typeof decoded?.header.typ === "string" ? (
          <Badge tone="neutral">typ: {decoded.header.typ}</Badge>
        ) : null}
        {expires !== null ? (
          <Badge tone={expires > 0 ? "success" : "error"}>
            {expires > 0 ? `expires in ${expires}s` : "expired"}
          </Badge>
        ) : null}
      </h3>
      <p className="mb-3 max-w-prose text-body-sm text-muted">{note}</p>

      <div className="flex flex-col gap-3">
        <Code label="raw" value={token} />
        {decoded ? (
          <>
            <Json label="header" value={decoded.header} />
            <Json label="payload" value={decoded.payload} />
          </>
        ) : (
          <Note>This is not a JWT, so there is nothing to decode.</Note>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onClick={() => {
              if (!jwksUri) return;
              void verify(token, jwksUri).then((result) =>
                setChecked(
                  result.ok
                    ? { ok: true, detail: `Signed by ${result.kid}.` }
                    : { ok: false, detail: result.reason },
                ),
              );
            }}
            disabled={!jwksUri}
          >
            Verify against JWKS
          </Button>
          {checked ? <Badge tone={checked.ok ? "success" : "error"}>{checked.detail}</Badge> : null}
        </div>

        {expectNonce ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <Check ok={decoded?.payload.nonce === expectNonce}>
              <span className="font-identity">nonce</span> matches the one sent
            </Check>
          </ul>
        ) : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 7 · Using them
// --------------------------------------------------------------------------

function UseStage({
  config,
  discovery,
  attempt,
  setAttempt,
  run,
  busy,
}: {
  config: Config;
  discovery: Discovery | null;
  attempt: ReturnType<typeof useAttempt>["attempt"];
  setAttempt: (patch: Partial<ReturnType<typeof useAttempt>["attempt"]>) => void;
  run: (name: string, work: () => Promise<void>) => Promise<void>;
  busy: string | null;
}) {
  const [result, setResult] = useState<Called | Exchange | null>(null);
  const tokens = attempt.tokens;
  const access = tokens?.access_token;

  if (!discovery || !tokens) {
    return (
      <Stage step={7} title="Using the tokens" disabled>
        <p className="text-body-sm text-muted">Get a token first.</p>
      </Stage>
    );
  }

  return (
    <Stage
      step={7}
      title="Using the tokens"
      lede="The endpoints a client actually calls after sign-in."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!access || busy !== null}
            onClick={() =>
              void run("userinfo", async () => {
                setResult(
                  await userinfo({
                    endpoint: discovery.userinfo_endpoint,
                    accessToken: access ?? "",
                    method: "GET",
                  }),
                );
              })
            }
          >
            GET /userinfo
          </Button>
          <Button
            size="sm"
            disabled={!access || busy !== null}
            onClick={() =>
              void run("userinfo-post", async () => {
                setResult(
                  await userinfo({
                    endpoint: discovery.userinfo_endpoint,
                    accessToken: access ?? "",
                    method: "POST",
                    inBody: true,
                  }),
                );
              })
            }
          >
            POST /userinfo (token in body)
          </Button>
          <Button
            size="sm"
            disabled={!tokens.refresh_token || busy !== null}
            onClick={() =>
              void run("refresh", async () => {
                const next = await refresh({
                  tokenEndpoint: discovery.token_endpoint,
                  refreshToken: tokens.refresh_token ?? "",
                  clientId: config.clientId,
                  clientSecret: config.clientSecret || undefined,
                });
                setResult(next);
                if (next.status === 200) setAttempt({ tokens: next.body });
              })
            }
          >
            Refresh
          </Button>
          {discovery.introspection_endpoint ? (
            <Button
              size="sm"
              disabled={!access || !config.clientSecret || busy !== null}
              title={
                config.clientSecret
                  ? undefined
                  : "Introspection needs a confidential client — a client_id alone is public by definition."
              }
              onClick={() =>
                void run("introspect", async () => {
                  setResult(
                    await introspect({
                      endpoint: discovery.introspection_endpoint ?? "",
                      token: access ?? "",
                      clientId: config.clientId,
                      clientSecret: config.clientSecret,
                    }),
                  );
                })
              }
            >
              Introspect
            </Button>
          ) : null}
          {discovery.revocation_endpoint ? (
            <Button
              size="sm"
              disabled={!tokens.refresh_token || busy !== null}
              onClick={() =>
                void run("revoke", async () => {
                  setResult(
                    await revoke({
                      endpoint: discovery.revocation_endpoint ?? "",
                      token: tokens.refresh_token ?? "",
                      hint: "refresh_token",
                      clientId: config.clientId,
                      clientSecret: config.clientSecret || undefined,
                    }),
                  );
                })
              }
            >
              Revoke refresh token
            </Button>
          ) : null}
          {discovery.end_session_endpoint ? (
            <Button
              size="sm"
              onClick={() => {
                const url = new URL(discovery.end_session_endpoint ?? "");
                if (tokens.id_token) url.searchParams.set("id_token_hint", tokens.id_token);
                window.location.assign(url.toString());
              }}
            >
              Sign out
            </Button>
          ) : null}
        </div>

        {result ? (
          <>
            <Code
              label={`${result.request.method} ${result.request.url}`}
              value={
                "body" in result.request
                  ? new URLSearchParams(result.request.body).toString()
                  : JSON.stringify(result.request.headers ?? {}, null, 2)
              }
            />
            <Json label={`${result.status} response`} value={result.body} />
          </>
        ) : null}

        <Note>
          Introspection is greyed out without a client secret on purpose: RFC 7662 requires a
          confidential client, and IDEN additionally lets a client see only its own tokens.
        </Note>
      </div>
    </Stage>
  );
}
