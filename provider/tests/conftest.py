"""Test fixtures.

Tests run against a real PostgreSQL database (`iden_test`), created once per
session and truncated between tests. Not SQLite: the models use PostgreSQL
arrays and UUIDs, and a test that passes on a different engine than production
proves less than it appears to.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from provider.core.config import settings
from provider.core.db import Base, get_db_session
from provider.core.redis import get_redis
from provider.core.security import hash_secret
from provider.shared.enums import ClientType, GrantType
from provider.shared.models import Client, ClientScope, Scope, User

BASE_URL = make_url(settings.iden_database_url)
TEST_URL = BASE_URL.set(database="iden_test")
MAINTENANCE_URL = BASE_URL.set(database="postgres")

# A separate Redis logical database, flushed between tests, so a test run can
# never evict a developer's live session.
TEST_REDIS_URL = f"{settings.iden_redis_url.rsplit('/', 1)[0]}/15"

ADMIN_EMAIL = "admin@test.local"
ADMIN_PASSWORD = "correct-horse-battery-staple"
REDIRECT_URI = "http://localhost:5173/callback"


@pytest.fixture(scope="session")
async def engine():
    admin = create_async_engine(MAINTENANCE_URL, isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        await conn.execute(text("DROP DATABASE IF EXISTS iden_test WITH (FORCE)"))
        await conn.execute(text("CREATE DATABASE iden_test"))
    await admin.dispose()

    test_engine = create_async_engine(TEST_URL)
    async with test_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    yield test_engine
    await test_engine.dispose()

    admin = create_async_engine(MAINTENANCE_URL, isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        await conn.execute(text("DROP DATABASE IF EXISTS iden_test WITH (FORCE)"))
    await admin.dispose()


@pytest.fixture
async def db(engine):
    """A session for the test body itself. Routes get their own — they commit,
    and the test must be able to see what they committed."""
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
async def redis():
    client = Redis.from_url(TEST_REDIS_URL, decode_responses=True)
    await client.flushdb()
    yield client
    # Flushed on the way out as well, so a finished run leaves nothing behind.
    await client.flushdb()
    await client.aclose()


@pytest.fixture
async def catalogue(db):
    """The system APIs, scopes, and roles, seeded by the real seed functions —
    so a drift between the seed and the tests shows up as a failure."""
    from scripts.seed import seed_catalogue, seed_roles

    scopes = await seed_catalogue(db)
    roles = await seed_roles(db, scopes)
    await db.commit()
    return {"scopes": scopes, "roles": roles}


@pytest.fixture
async def admin_user(db, catalogue) -> User:
    user = User(
        email=ADMIN_EMAIL,
        username="admin",
        display_name="Administrator",
        password_hash=hash_secret(ADMIN_PASSWORD),
    )
    user.roles = [catalogue["roles"]["administrator"]]
    db.add(user)
    await db.commit()
    return user


@pytest.fixture
async def dashboard(db, catalogue) -> Client:
    client = Client(
        client_id="dashboard",
        name="IDEN Dashboard",
        client_type=ClientType.PUBLIC,
        allowed_grants=[GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        redirect_uris=[REDIRECT_URI],
        post_logout_redirect_uris=["http://localhost:5173/"],
        skip_consent=True,
    )
    db.add(client)
    await db.flush()

    for scope in catalogue["scopes"].values():
        db.add(ClientScope(client_id=client.id, scope_id=scope.id, grantable=True))
    await db.commit()
    return client


@pytest.fixture
async def kiosk(db, catalogue) -> tuple[Client, str]:
    """Returns the client and its cleartext secret."""
    secret = "kiosk-test-secret"
    client = Client(
        client_id="kiosk",
        name="Biometric Kiosk",
        client_type=ClientType.CONFIDENTIAL,
        client_secret_hash=hash_secret(secret),
        allowed_grants=[GrantType.CLIENT_CREDENTIALS],
        skip_consent=True,
    )
    db.add(client)
    await db.flush()

    granted = catalogue["scopes"]["entity:profile:read"]
    db.add(ClientScope(client_id=client.id, scope_id=granted.id, grantable=False, granted=True))
    await db.commit()
    return client, secret


@pytest.fixture
async def client(engine, redis) -> AsyncClient:
    """An HTTP client wired to the app in-process — no live server, no port."""
    from provider.core.app import app

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_redis] = lambda: redis

    # base_url matches the configured issuer on purpose: /authorize builds
    # absolute resume URLs from it, and a cookie set on one host is not sent to
    # another. Mismatched hosts silently break the login round-trip.
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url=settings.iden_issuer) as http:
        yield http

    app.dependency_overrides.clear()


@pytest.fixture
def scope_of(catalogue):
    """Look up a seeded Scope by its value."""
    return lambda value: catalogue["scopes"][value]


@pytest.fixture
async def token_for(db, admin_user, dashboard):
    """Mint an access token carrying exactly the given scopes.

    Lets a test assert on authorization directly, without running a login flow
    it is not the subject of.
    """
    from provider.authz.services import token_service

    async def _mint(*scopes: str, user: User | None = None) -> dict[str, str]:
        token, _, _ = await token_service.mint_access_token(
            db,
            subject=str((user or admin_user).id),
            client=dashboard,
            scopes=set(scopes),
            acr="iden:loa:1",
            amr=["pwd"],
        )
        return {"Authorization": f"Bearer {token}"}

    return _mint


@pytest.fixture
async def admin_headers(token_for, catalogue):
    """Every admin scope — for tests whose subject is the resource, not the gate."""
    return await token_for(*[v for v in catalogue["scopes"] if v.startswith("admin:")])
