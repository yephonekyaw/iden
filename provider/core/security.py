"""Password / client-secret hashing and random token generation."""

import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()


def hash_secret(plaintext: str) -> str:
    return _hasher.hash(plaintext)


def verify_secret(plaintext: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, plaintext)
    except VerifyMismatchError:
        return False


def generate_client_id() -> str:
    return secrets.token_urlsafe(18)


def generate_client_secret() -> str:
    return secrets.token_urlsafe(32)
