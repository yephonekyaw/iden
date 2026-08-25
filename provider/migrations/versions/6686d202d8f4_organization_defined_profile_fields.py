"""organization-defined profile fields

Revision ID: 6686d202d8f4
Revises: 8eb8d010f37a
Create Date: 2026-08-25 14:47:44.474390
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "6686d202d8f4"
down_revision: str | None = "8eb8d010f37a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profile_fields",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("data_type", sa.String(length=16), nullable=False),
        sa.Column("options", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.Column("unique", sa.Boolean(), nullable=False),
        sa.Column(
            "validators", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("user_readable", sa.Boolean(), nullable=False),
        sa.Column("user_writable", sa.Boolean(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=True),
        sa.Column("claim_name", sa.String(length=64), nullable=True),
        sa.Column("claim_scope", sa.String(length=128), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
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
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_table(
        "user_profile_values",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("field_id", sa.UUID(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("is_unique", sa.Boolean(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["field_id"], ["profile_fields.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "field_id"),
    )
    op.create_index(
        "ix_user_profile_values_unique",
        "user_profile_values",
        ["field_id", "value"],
        unique=True,
        postgresql_where=sa.text("is_unique"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_profile_values_unique",
        table_name="user_profile_values",
        postgresql_where=sa.text("is_unique"),
    )
    op.drop_table("user_profile_values")
    op.drop_table("profile_fields")
