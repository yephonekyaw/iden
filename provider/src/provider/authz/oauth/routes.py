import base64
from typing import Annotated
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, Form, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from provider.authz import session_cookie
from provider.authz.consent.service import consent_required
from provider.authz.deps import LoginSessionDep
from provider.authz.oauth.errors import (
    InvalidClient,
    InvalidGrant,
    OAuthError,
    RedirectableError,
)
from provider.authz.oauth.schemas import (
    IntrospectionResponse,
    OAuthErrorResponse,
    TokenResponse,
    UserInfoResponse,
)
from provider.authz.oauth.service import (
    authenticate_client,
    consume_code,
    get_client,
    issue_code,
    redirect_uri_registered,
)
from provider.authz.services import auth_methods, challenge_store, session_store
from provider.authz.services import token_service as tokens
from provider.authz.services.scope_resolver import (
    format_scope,
    parse_scope,
    resolve_for_client,
    resolve_for_user,
)
from provider.core.config import settings
from provider.core.crypto import verify_jwt
from provider.core.db import DBSessionDep
from provider.core.security import hash_token
from provider.core.redis import RedisDep
from provider.shared.enums import ClientType, CodeChallengeMethod, GrantType
from provider.shared.models import Client, RefreshToken, User

router = APIRouter(prefix="/oauth2", tags=["oauth2"])


def _auth_ui(path: str, challenge_id: str, **extra: str) -> RedirectResponse:
    query = urlencode({"challenge": challenge_id, **extra})
    return RedirectResponse(f"{settings.iden_auth_ui_base_url}{path}?{query}", status_code=303)


@router.get(
    "/authorize",
    summary="Start an authorization request",
    description=(
        "The entry point for the authorization code flow. **PKCE with `S256` is "
        "required of every client**, public or confidential — there is no "
        "non-PKCE path.\n\n"
        "Redirects to the hosted Auth UI when the browser has no session, when "
        "the session does not meet the requested `acr_values`, or when consent "
        "is needed. Otherwise issues a code and returns to `redirect_uri`.\n\n"
        "`client_id` and `redirect_uri` errors render as JSON rather than "
        "redirecting: before those two are validated the URI is unverified, and "
        "redirecting to it would make this an open redirector (RFC 6749 §3.1.2.3).\n\n"
        "**Required scope:** none — this is how tokens are obtained."
    ),
    responses={
        303: {"description": "Redirect to the Auth UI, or back to the client with a code"},
        400: {"model": OAuthErrorResponse, "description": "Unknown client or unregistered redirect_uri"},
    },
)
async def authorize(
    request: Request,
    login_session: LoginSessionDep,
    session: DBSessionDep,
    redis: RedisDep,
    client_id: Annotated[str, Query()],
    redirect_uri: Annotated[str, Query()],
    response_type: Annotated[str, Query()] = "code",
    scope: Annotated[str, Query()] = "",
    state: Annotated[str | None, Query()] = None,
    code_challenge: Annotated[str | None, Query()] = None,
    code_challenge_method: Annotated[str, Query()] = CodeChallengeMethod.S256,
    nonce: Annotated[str | None, Query()] = None,
    acr_values: Annotated[str | None, Query()] = None,
) -> Response:
    client = await get_client(session, client_id)
    if client is None:
        raise OAuthError("invalid_client", "Unknown client.")

    if not redirect_uri_registered(client, redirect_uri):
        raise OAuthError("invalid_request", "redirect_uri is not registered for this client.")

    # Past this point the redirect target is trusted, so errors go to the client.
    def fail(error: str, description: str) -> RedirectableError:
        return RedirectableError(error, description, redirect_uri, state)

    if response_type != "code":
        raise fail("unsupported_response_type", "Only response_type=code is supported.")

    if GrantType.AUTHORIZATION_CODE not in client.allowed_grants:
        raise fail("unauthorized_client", "This client may not use the authorization code grant.")

    if not code_challenge:
        raise fail("invalid_request", "code_challenge is required — IDEN mandates PKCE.")

    if code_challenge_method != CodeChallengeMethod.S256:
        raise fail("invalid_request", "code_challenge_method must be S256.")

    params = dict(request.query_params)

    if login_session is None:
        challenge = await challenge_store.create(redis, params)
        return _auth_ui("/auth/login", challenge.id)

    acr = auth_methods.derive_acr(login_session.amr)
    if not auth_methods.meets(acr, acr_values):
        challenge = await challenge_store.create(redis, params)
        challenge.user_id = login_session.user_id
        await challenge_store.save(redis, challenge)
        return _auth_ui("/auth/login", challenge.id, step_up="1")

    user = await session.get(User, login_session.user_id)
    if user is None or not user.is_active:
        challenge = await challenge_store.create(redis, params)
        return _auth_ui("/auth/login", challenge.id)

    requested = parse_scope(scope)
    granted = resolve_for_user(requested, client, user)

    if await consent_required(session, user, client, granted):
        challenge = await challenge_store.create(redis, params)
        challenge.user_id = user.id
        await challenge_store.save(redis, challenge)
        return _auth_ui("/auth/consent", challenge.id)

    code = await issue_code(
        session,
        client=client,
        user=user,
        params={**params, "code_challenge_method": code_challenge_method},
        scopes=granted,
        acr=acr,
        amr=auth_methods.normalized_amr(login_session.amr),
    )
    await session.commit()

    query = {"code": code}
    if state:
        query["state"] = state
    return RedirectResponse(f"{redirect_uri}?{urlencode(query)}", status_code=303)


def _client_auth(request: Request, client_id: str | None, client_secret: str | None):
    """client_secret_basic takes precedence over client_secret_post — RFC 6749 §2.3.1."""
    header = request.headers.get("authorization", "")
    scheme, _, encoded = header.partition(" ")

    if scheme.lower() == "basic" and encoded:
        try:
            decoded = base64.b64decode(encoded).decode()
        except ValueError as exc:
            raise InvalidClient("Malformed Basic authorization header.") from exc
        name, _, secret = decoded.partition(":")
        return name, secret

    return client_id, client_secret


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Exchange a grant for tokens",
    description=(
        "Supports three grant types:\n\n"
        "- `authorization_code` — with `code_verifier`; returns access, ID, and refresh tokens\n"
        "- `refresh_token` — rotates the token and re-resolves permissions, so a "
        "revoked role takes effect here\n"
        "- `client_credentials` — confidential clients only; no user, so no ID or refresh token\n\n"
        "**Required scope:** none — client authentication only."
    ),
    responses={
        400: {"model": OAuthErrorResponse, "description": "invalid_grant or invalid_request"},
        401: {"model": OAuthErrorResponse, "description": "invalid_client"},
    },
)
async def token(
    request: Request,
    session: DBSessionDep,
    grant_type: Annotated[str, Form()],
    code: Annotated[str | None, Form()] = None,
    redirect_uri: Annotated[str | None, Form()] = None,
    code_verifier: Annotated[str | None, Form()] = None,
    refresh_token: Annotated[str | None, Form()] = None,
    scope: Annotated[str | None, Form()] = None,
    client_id: Annotated[str | None, Form()] = None,
    client_secret: Annotated[str | None, Form()] = None,
) -> TokenResponse:
    name, secret = _client_auth(request, client_id, client_secret)
    client = await authenticate_client(session, name, secret, grant_type)

    match grant_type:
        case GrantType.AUTHORIZATION_CODE:
            if not code:
                raise OAuthError("invalid_request", "code is required.")
            return await _authorization_code_grant(
                session, client, code, redirect_uri, code_verifier
            )
        case GrantType.REFRESH_TOKEN:
            if not refresh_token:
                raise OAuthError("invalid_request", "refresh_token is required.")
            return await _refresh_token_grant(session, client, refresh_token, scope)
        case GrantType.CLIENT_CREDENTIALS:
            return await _client_credentials_grant(session, client, scope)
        case _:
            raise OAuthError("unsupported_grant_type", f"Unsupported grant_type: {grant_type}")


async def _authorization_code_grant(
    session, client: Client, code: str, redirect_uri: str | None, code_verifier: str | None
) -> TokenResponse:
    record = await consume_code(
        session, code=code, client=client, redirect_uri=redirect_uri, code_verifier=code_verifier
    )
    user = await session.get(User, record.user_id)
    scopes = parse_scope(record.scope)

    access_token, _, expires_in = await tokens.mint_access_token(
        session, subject=str(user.id), client=client, scopes=scopes, acr=record.acr, amr=record.amr
    )

    refresh = None
    if GrantType.REFRESH_TOKEN in client.allowed_grants:
        refresh, _ = await tokens.issue_refresh_token(
            session, client=client, user=user, scope=record.scope, acr=record.acr, amr=record.amr
        )

    id_token = None
    if "openid" in scopes:
        id_token = tokens.mint_id_token(
            user,
            client,
            scopes=scopes,
            acr=record.acr,
            amr=record.amr,
            authenticated_at=record.created_at,
            nonce=record.nonce,
        )

    await session.commit()
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        scope=record.scope,
        refresh_token=refresh,
        id_token=id_token,
    )


async def _refresh_token_grant(
    session, client: Client, refresh_token: str, requested_scope: str | None
) -> TokenResponse:
    try:
        record = await tokens.consume_refresh_token(session, refresh_token)
    except tokens.RefreshTokenReuse as exc:
        await session.commit()
        raise InvalidGrant("Refresh token reuse detected; the token family has been revoked.") from exc

    if record is None:
        raise InvalidGrant("Unknown or expired refresh token.")

    if record.client_id != client.id:
        raise InvalidGrant("This refresh token was issued to a different client.")

    user = await session.get(User, record.user_id)
    if user is None or not user.is_active:
        await tokens.revoke_family(session, record.family_id)
        await session.commit()
        raise InvalidGrant("The user is no longer active.")

    # Re-resolved rather than replayed: this is where a revoked role or a
    # narrowed client actually takes effect. RFC 6749 §6 forbids widening, and
    # an intersection cannot widen.
    previous = parse_scope(record.scope)
    narrowed = parse_scope(requested_scope) & previous if requested_scope else previous
    granted = resolve_for_user(narrowed, client, user)

    new_token, new_record = await tokens.issue_refresh_token(
        session,
        client=client,
        user=user,
        scope=format_scope(granted),
        acr=record.acr,
        amr=record.amr,
        family_id=record.family_id,
    )
    record.rotated_to_id = new_record.id
    record.revoked_at = tokens.now()

    access_token, _, expires_in = await tokens.mint_access_token(
        session, subject=str(user.id), client=client, scopes=granted, acr=record.acr, amr=record.amr
    )

    id_token = None
    if "openid" in granted:
        id_token = tokens.mint_id_token(
            user,
            client,
            scopes=granted,
            acr=record.acr,
            amr=record.amr,
            authenticated_at=record.created_at,
        )

    await session.commit()
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        scope=format_scope(granted),
        refresh_token=new_token,
        id_token=id_token,
    )


async def _client_credentials_grant(
    session, client: Client, requested_scope: str | None
) -> TokenResponse:
    if client.client_type != ClientType.CONFIDENTIAL:
        raise InvalidClient("Only confidential clients may use client_credentials.")

    granted = resolve_for_client(parse_scope(requested_scope), client)

    # sub is the client itself: there is no person behind this token.
    access_token, _, expires_in = await tokens.mint_access_token(
        session, subject=client.client_id, client=client, scopes=granted
    )
    await session.commit()

    return TokenResponse(
        access_token=access_token, expires_in=expires_in, scope=format_scope(granted)
    )


async def _verify_access_token(request: Request, redis) -> dict:
    """Verify a bearer token for IDEN's own OIDC endpoints.

    Audience is deliberately not checked here: an access token's `aud` names the
    resource APIs its scopes belong to, while /userinfo is IDEN describing the
    user to the client. Requiring `openid` is the real gate (OIDC Core §5.3).
    """
    header = request.headers.get("authorization", "")
    scheme, _, raw = header.partition(" ")
    if scheme.lower() != "bearer" or not raw:
        raise OAuthError("invalid_token", "A bearer access token is required.", status_code=401)

    try:
        claims = verify_jwt(raw)
    except jwt.PyJWTError as exc:
        raise OAuthError("invalid_token", str(exc), status_code=401) from exc

    if await tokens.is_denylisted(redis, claims["jti"]):
        raise OAuthError("invalid_token", "This token has been revoked.", status_code=401)

    return claims


@router.get(
    "/userinfo",
    response_model=UserInfoResponse,
    response_model_exclude_none=True,
    summary="Claims about the signed-in user",
    description=(
        "Returns the claims released by the granted scopes: `sub` always, plus "
        "`profile` and `email` claims when those scopes were granted.\n\n"
        "**Required scope:** `openid`"
    ),
    responses={401: {"model": OAuthErrorResponse, "description": "Missing, invalid, or revoked token"}},
)
async def userinfo(request: Request, session: DBSessionDep, redis: RedisDep) -> UserInfoResponse:
    claims = await _verify_access_token(request, redis)
    scopes = parse_scope(claims.get("scope"))

    if "openid" not in scopes:
        raise OAuthError("insufficient_scope", "The openid scope is required.", status_code=403)

    user = await session.get(User, claims["sub"])
    if user is None:
        raise OAuthError("invalid_token", "The subject no longer exists.", status_code=401)

    return UserInfoResponse(sub=str(user.id), **tokens.identity_claims(user, scopes))


@router.post(
    "/revoke",
    status_code=200,
    summary="Revoke a token",
    description=(
        "RFC 7009. A refresh token revokes its whole family; an access token is "
        "added to the `jti` denylist until it would have expired anyway.\n\n"
        "Always returns `200`, even for an unknown token — RFC 7009 §2.2 requires "
        "it, so that this endpoint cannot be used to probe which tokens exist.\n\n"
        "**Required scope:** none — client authentication only."
    ),
    responses={401: {"model": OAuthErrorResponse, "description": "invalid_client"}},
)
async def revoke(
    request: Request,
    session: DBSessionDep,
    redis: RedisDep,
    token: Annotated[str, Form()],
    token_type_hint: Annotated[str | None, Form()] = None,
    client_id: Annotated[str | None, Form()] = None,
    client_secret: Annotated[str | None, Form()] = None,
) -> Response:
    name, secret = _client_auth(request, client_id, client_secret)
    client = await get_client(session, name)
    if client is None:
        raise InvalidClient("Unknown client.")
    if client.client_type == ClientType.CONFIDENTIAL:
        await authenticate_client(session, name, secret, client.allowed_grants[0])

    record = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(token))
    )
    if record is not None and record.client_id == client.id:
        await tokens.revoke_family(session, record.family_id)
        await session.commit()
        return Response(status_code=200)

    try:
        claims = verify_jwt(token)
    except jwt.PyJWTError:
        return Response(status_code=200)

    if claims.get("client_id") == client.client_id:
        await tokens.denylist_access_token(redis, claims["jti"], claims["exp"])

    return Response(status_code=200)


@router.post(
    "/introspect",
    response_model=IntrospectionResponse,
    response_model_exclude_none=True,
    summary="Inspect a token",
    description=(
        "RFC 7662. Present mainly for consumers that cannot validate a JWT "
        "locally — IDEN's own modules and any resource server with JWKS access "
        "should validate offline instead of calling this on every request.\n\n"
        "**Required scope:** none — client authentication only."
    ),
    responses={401: {"model": OAuthErrorResponse, "description": "invalid_client"}},
)
async def introspect(
    request: Request,
    session: DBSessionDep,
    redis: RedisDep,
    token: Annotated[str, Form()],
    token_type_hint: Annotated[str | None, Form()] = None,
    client_id: Annotated[str | None, Form()] = None,
    client_secret: Annotated[str | None, Form()] = None,
) -> IntrospectionResponse:
    name, secret = _client_auth(request, client_id, client_secret)
    client = await get_client(session, name)
    if client is None:
        raise InvalidClient("Unknown client.")
    if client.client_type == ClientType.CONFIDENTIAL:
        await authenticate_client(session, name, secret, client.allowed_grants[0])

    try:
        claims = verify_jwt(token)
    except jwt.PyJWTError:
        return IntrospectionResponse(active=False)

    if await tokens.is_denylisted(redis, claims["jti"]):
        return IntrospectionResponse(active=False)

    return IntrospectionResponse(
        active=True,
        scope=claims.get("scope"),
        client_id=claims.get("client_id"),
        sub=claims.get("sub"),
        aud=claims.get("aud"),
        exp=claims.get("exp"),
        iat=claims.get("iat"),
        jti=claims.get("jti"),
        token_type="Bearer",
    )


@router.get(
    "/logout",
    summary="End the session",
    description=(
        "Clears the browser session and its cookie, then returns to "
        "`post_logout_redirect_uri` when that URI is registered for the client.\n\n"
        "This ends the IDEN session only. Access tokens already issued remain "
        "valid until they expire — revoke them explicitly if that matters.\n\n"
        "**Required scope:** none."
    ),
    responses={303: {"description": "Redirect to post_logout_redirect_uri"}},
)
async def logout(
    login_session: LoginSessionDep,
    session: DBSessionDep,
    redis: RedisDep,
    client_id: Annotated[str | None, Query()] = None,
    post_logout_redirect_uri: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
) -> Response:
    if login_session is not None:
        await session_store.delete(redis, login_session.id)

    client = await get_client(session, client_id)
    target = None
    if client and post_logout_redirect_uri in client.post_logout_redirect_uris:
        query = f"?{urlencode({'state': state})}" if state else ""
        target = f"{post_logout_redirect_uri}{query}"

    response = RedirectResponse(target, status_code=303) if target else Response(status_code=204)
    session_cookie.clear_session(response)
    return response
