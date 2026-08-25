"""session id on codes and refresh tokens

Autogenerate produced four plain ADD COLUMNs, two of them NOT NULL with no
default, which fails against any database holding rows. Adjusted by hand:

- Authorization codes are deleted first. They live 60 seconds, so the worst
  case is one person retrying a login that was mid-flight during the deploy.
- Refresh tokens live 30 days and must survive, so `authenticated_at` is
  backfilled from `created_at` before the NOT NULL goes on: for a token issued
  before this column existed, the moment it was created is the closest record
  of when its owner authenticated.
- `sid` on a refresh token stays nullable. There is no value to backfill it
  with — those sessions were never recorded — and inventing one would make a
  token look like it belonged to a session that could be signed out.

Revision ID: 0a06c05f5303
Revises: dfd306c91f9e
Create Date: 2026-08-25 12:56:42.139329
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0a06c05f5303"
down_revision: str | None = "dfd306c91f9e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM authorization_codes")
    op.add_column(
        "authorization_codes", sa.Column("sid", sa.String(length=64), nullable=False)
    )
    op.add_column(
        "authorization_codes",
        sa.Column("authenticated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.add_column(
        "refresh_tokens", sa.Column("sid", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("authenticated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE refresh_tokens SET authenticated_at = created_at")
    op.alter_column("refresh_tokens", "authenticated_at", nullable=False)

    op.create_index("ix_refresh_tokens_sid", "refresh_tokens", ["sid"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_sid", table_name="refresh_tokens")
    op.drop_column("refresh_tokens", "authenticated_at")
    op.drop_column("refresh_tokens", "sid")
    op.drop_column("authorization_codes", "authenticated_at")
    op.drop_column("authorization_codes", "sid")
