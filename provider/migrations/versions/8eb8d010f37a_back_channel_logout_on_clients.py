"""back-channel logout on clients

Autogenerate emitted the boolean as NOT NULL with no default, which fails
against any database that already has clients in it. Added with a server
default of false, which is then dropped: existing clients are not registered
for back-channel logout, and the column default afterwards belongs to the model
rather than to the schema.

Revision ID: 8eb8d010f37a
Revises: 0a06c05f5303
Create Date: 2026-08-25 13:06:25.995443
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8eb8d010f37a"
down_revision: str | None = "0a06c05f5303"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("backchannel_logout_uri", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "clients",
        sa.Column(
            "backchannel_logout_session_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.alter_column(
        "clients", "backchannel_logout_session_required", server_default=None
    )


def downgrade() -> None:
    op.drop_column("clients", "backchannel_logout_session_required")
    op.drop_column("clients", "backchannel_logout_uri")
