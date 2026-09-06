from functools import cache
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from jwt.algorithms import RSAAlgorithm

from provider.core.config import settings


class SigningKeyError(RuntimeError):
    pass


@cache
def _keys() -> dict[str, RSAPrivateKey]:
    """
    Every `*.pem` in the signing key directory is a private key whose filename
    stem becomes its `kid`. Holding several at once is what makes rotation a
    config change: publish the new key, sign with it, retire the old one once
    outstanding tokens have expired.
    """
    key_dir = settings.iden_signing_key_dir
    paths = sorted(key_dir.glob("*.pem")) if key_dir.is_dir() else []
    if not paths:
        raise SigningKeyError(
            f"No signing keys in {key_dir}. Run: uv run python -m scripts.gen_keys"
        )

    loaded = {}
    for path in paths:
        key = load_pem_private_key(path.read_bytes(), password=None)
        if not isinstance(key, RSAPrivateKey):
            raise SigningKeyError(f"{path} is not an RSA private key.")
        loaded[path.stem] = key
    return loaded


def active_kid() -> str:
    # Keys sort by filename, so a date-stamped name makes the newest key active.
    return sorted(_keys())[-1]


# The JOSE `typ` header each kind of token carries. Every token IDEN signs says
# what it is, and every consumer says what it will accept — which is what stops
# one being presented where another belongs (RFC 9068 §2.1, OIDC Back-Channel
# Logout 1.0 §2.4). Without it the only thing separating an ID token from an
# access token at a protected resource is which claims it happens to have.
ACCESS_TOKEN_TYP = "at+jwt"
ID_TOKEN_TYP = "JWT"
LOGOUT_TOKEN_TYP = "logout+jwt"


def sign_jwt(claims: dict[str, Any], *, typ: str = ID_TOKEN_TYP) -> str:
    kid = active_kid()
    return jwt.encode(
        claims,
        _keys()[kid],
        algorithm=settings.iden_signing_algorithm,
        headers={"kid": kid, "typ": typ},
    )


def verify_jwt(
    token: str,
    audience: str | None = None,
    *,
    allow_expired: bool = False,
    typ: str | None = None,
) -> dict[str, Any]:
    """Verify signature, issuer, expiry, and — when given — audience and type.

    `allow_expired` is for `id_token_hint`, where an expired token is the normal
    case: the client is saying *this is who I last saw signed in*, and ID tokens
    are minted to live ten minutes. The signature and issuer are still checked,
    so the hint remains IDEN's own statement rather than the caller's.

    `typ` is how a caller says which kind of token it will accept. It is
    deliberately opt-in rather than always-on: `id_token_hint` accepts an ID
    token and `/introspect` accepts anything IDEN signed, so a blanket rule
    would be wrong in exactly the places that matter.

    Raises the underlying `jwt.PyJWTError` on failure; callers decide the HTTP shape.
    """
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    key = _keys().get(kid) if isinstance(kid, str) else None
    if key is None:
        raise jwt.InvalidKeyError(f"Unknown kid: {kid}")

    if typ is not None:
        # Case-insensitive, and an absent `typ` is a mismatch rather than a pass:
        # RFC 8725 §3.11 treats the header as a claim about the token, so the
        # only safe reading of silence is "not the type you asked for".
        declared = header.get("typ")
        if not isinstance(declared, str) or declared.lower() != typ.lower():
            raise jwt.InvalidTokenError(
                f"Expected a {typ} token, got {declared or 'none'}."
            )

    return jwt.decode(
        token,
        key.public_key(),
        algorithms=[settings.iden_signing_algorithm],
        issuer=settings.iden_issuer,
        audience=audience,
        options={
            "verify_aud": audience is not None,
            "verify_exp": not allow_expired,
            "require": ["exp", "iat", "iss"],
        },
    )


def jwks() -> dict[str, list[dict[str, Any]]]:
    keys = []
    for kid, key in _keys().items():
        jwk = RSAAlgorithm.to_jwk(key.public_key(), as_dict=True)
        keys.append(
            {**jwk, "kid": kid, "use": "sig", "alg": settings.iden_signing_algorithm}
        )
    return {"keys": keys}
