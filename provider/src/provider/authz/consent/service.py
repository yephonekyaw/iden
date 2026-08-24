from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.shared.models import Client, ConsentGrant, User


async def consent_required(
    session: AsyncSession, user: User, client: Client, scopes: set[str]
) -> bool:
    """Whether the user must be asked before these scopes are granted.

    Skipped for first-party clients, and for scopes already covered by an
    earlier grant — a user should be asked once, not on every login.
    """
    if client.skip_consent:
        return False

    grant = await session.scalar(
        select(ConsentGrant).where(
            ConsentGrant.user_id == user.id, ConsentGrant.client_id == client.id
        )
    )
    if grant is None:
        return True

    return not scopes.issubset(set(grant.scopes))


async def record_consent(
    session: AsyncSession, user: User, client: Client, scopes: set[str]
) -> ConsentGrant:
    """Merge into any existing grant, so consenting to a new scope does not
    silently withdraw an older one."""
    grant = await session.scalar(
        select(ConsentGrant).where(
            ConsentGrant.user_id == user.id, ConsentGrant.client_id == client.id
        )
    )
    if grant is None:
        grant = ConsentGrant(user_id=user.id, client_id=client.id, scopes=[])
        session.add(grant)

    grant.scopes = sorted(set(grant.scopes) | scopes)
    await session.flush()
    return grant
