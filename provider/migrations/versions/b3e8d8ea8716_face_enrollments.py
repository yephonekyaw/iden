"""face enrollments

Revision ID: b3e8d8ea8716
Revises: 6686d202d8f4
Create Date: 2026-08-26 15:30:00.000000
"""

from collections.abc import Sequence

import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op

revision: str = "b3e8d8ea8716"
down_revision: str | None = "6686d202d8f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Already enabled by 582ce19a8898 (initial_schema); IF NOT EXISTS makes
    # this safe on any database, including one seeded before this migration
    # existed.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "face_enrollments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(512), nullable=False),
        sa.Column("quality", sa.Float(), nullable=False),
        sa.Column("image_object_key", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("face_enrollments")
