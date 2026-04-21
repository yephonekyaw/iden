"""Authorization dependencies.

``require_scope`` is a placeholder today — it returns immediately and does
not check the caller. When admin auth is wired up it becomes the single
spot to implement token introspection and scope verification.
"""

from collections.abc import Callable, Coroutine
from typing import Any


def require_scope(scope: str) -> Callable[..., Coroutine[Any, Any, None]]:
    async def _dep() -> None:
        # TODO: verify the caller's access token includes ``scope``.
        return None

    _dep.__name__ = f"require_scope_{scope.replace(':', '_').replace('-', '_')}"
    return _dep
