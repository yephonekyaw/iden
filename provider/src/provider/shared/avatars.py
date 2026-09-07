"""Where a profile photo lives and what it is called."""

import secrets

from provider.core.config import settings

PREFIX = "avatars/"


def new_name() -> str:
    """A fresh, unguessable file name for one photo.

    The name is the only thing guarding the object, because `/media/avatars/*`
    has to answer without a token — an `<img>` tag in someone else's
    application cannot present one. Minting a new name on every upload is also
    what makes replacing a photo retire the URL the old one was served from.
    """
    return f"{secrets.token_urlsafe(24)}.webp"


def object_key(name: str) -> str:
    return f"{PREFIX}{name}"


def public_url(name: str | None) -> str | None:
    if name is None:
        return None
    return f"{settings.iden_issuer}/media/avatars/{name}"
