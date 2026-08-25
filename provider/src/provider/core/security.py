import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

# OWASP-recommended argon2id parameters.
_hasher = PasswordHasher(time_cost=1, memory_cost=64 * 1024, parallelism=4)


def hash_secret(secret: str) -> str:
    """Hash a user password or client secret. Salted, so the digest differs every call."""
    return _hasher.hash(secret)


def verify_secret(hashed: str | None, secret: str) -> bool:
    # `None` is a public client's absent `client_secret_hash`: nothing to verify
    # against, so nothing can match.
    if hashed is None:
        return False
    try:
        return _hasher.verify(hashed, secret)
    except VerifyMismatchError, VerificationError:
        return False


def needs_rehash(hashed: str) -> bool:
    return _hasher.check_needs_rehash(hashed)


def generate_token(nbytes: int = 32) -> str:
    """A URL-safe random string for authorization codes, refresh tokens, and client secrets."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """
    Deterministic digest for tokens that must be *looked up* by value —
    authorization codes, refresh tokens, session ids.

    Argon2 salts every hash, so an argon2 digest cannot be used as a lookup key.
    These values are already high-entropy random strings, so they are not
    brute-forceable the way a password is and SHA-256 is sufficient.
    """
    return hashlib.sha256(token.encode()).hexdigest()
