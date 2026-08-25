"""audit events

The append-only record behind KI-12. `actor_user_id` is ON DELETE SET NULL so
that deleting a user cannot erase what they did; `actor_label` keeps their
email as it was at the time.

Revision ID: dfd306c91f9e
Revises: 582ce19a8898
Create Date: 2026-08-25 11:06:38.201849
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "dfd306c91f9e"
down_revision: str | None = "582ce19a8898"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("action", sa.String(length=160), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=True),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("actor_label", sa.String(length=255), nullable=True),
        sa.Column("actor_client", sa.String(length=128), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_events_actor_user_id", "audit_events", ["actor_user_id"], unique=False
    )
    op.create_index(
        "ix_audit_events_occurred_at", "audit_events", ["occurred_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_audit_events_occurred_at", table_name="audit_events")
    op.drop_index("ix_audit_events_actor_user_id", table_name="audit_events")
    op.drop_table("audit_events")
