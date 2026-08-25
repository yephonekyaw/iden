"""Response headers every route sends, whoever wrote the route.

Pure ASGI rather than `@app.middleware("http")`: headers belong on redirects and
streaming responses too, and a function middleware would have to buffer a body
it has no other reason to touch.
"""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from provider.core.config import settings

# The provider serves JSON, so nothing may load. The docs UIs are the one
# exception — they pull Swagger and ReDoc from a CDN — and they render no
# user data, so a looser policy there costs nothing.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
DOCS_CSP = "frame-ancestors 'none'; base-uri 'none'"

DOCS_PATHS = frozenset({"/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"})

# Discovery and JWKS are the only responses worth caching, and the age is a
# rotation budget: a resource server will not notice a new signing key until
# its copy of this expires.
CACHEABLE_PATHS = frozenset(
    {"/.well-known/openid-configuration", "/.well-known/jwks.json"}
)
CACHEABLE_MAX_AGE = 300

# X-Frame-Options is deliberately absent: `frame-ancestors` replaces it in every
# browser new enough to run an OIDC client, and two headers expressing one
# policy is one more place for them to disagree.
STATIC_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
}


def _headers_for(path: str) -> dict[str, str]:
    headers = dict(STATIC_HEADERS)
    headers["content-security-policy"] = DOCS_CSP if path in DOCS_PATHS else API_CSP

    if path in CACHEABLE_PATHS:
        headers["cache-control"] = f"public, max-age={CACHEABLE_MAX_AGE}"
    else:
        # RFC 6749 §5.1 requires both on any response carrying a token. Every
        # other response either carries a credential or is cheap to recompute,
        # so the blanket rule is simpler than a list of exceptions.
        headers["cache-control"] = "no-store"
        headers["pragma"] = "no-cache"

    # Only over TLS, and only in production. A browser that receives HSTS from
    # http://localhost pins *every* project on localhost to HTTPS, which is
    # slow to discover and tedious to undo.
    if settings.iden_env == "prod":
        headers["strict-transport-security"] = "max-age=31536000; includeSubDomains"

    return headers


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        defaults = _headers_for(scope["path"])

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in defaults.items():
                    # A route that set its own is making a deliberate choice.
                    if name not in headers:
                        headers[name] = value
            await send(message)

        await self.app(scope, receive, send_with_headers)
