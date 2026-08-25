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


def sign_jwt(claims: dict[str, Any]) -> str:
    kid = active_kid()
    return jwt.encode(
        claims,
        _keys()[kid],
        algorithm=settings.iden_signing_algorithm,
        headers={"kid": kid},
    )


def verify_jwt(
    token: str, audience: str | None = None, *, allow_expired: bool = False
) -> dict[str, Any]:
    """Verify signature, issuer, expiry, and — when given — audience.

    `allow_expired` is for `id_token_hint`, where an expired token is the normal
    case: the client is saying *this is who I last saw signed in*, and ID tokens
    are minted to live ten minutes. The signature and issuer are still checked,
    so the hint remains IDEN's own statement rather than the caller's.

    Raises the underlying `jwt.PyJWTError` on failure; callers decide the HTTP shape.
    """
    kid = jwt.get_unverified_header(token).get("kid")
    key = _keys().get(kid) if isinstance(kid, str) else None
    if key is None:
        raise jwt.InvalidKeyError(f"Unknown kid: {kid}")

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
