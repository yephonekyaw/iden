"""ORM models — single source of truth for the database schema.

Tables follow the ERD in README.md. The five ``oauth2_*`` tables hold
Authlib's grant-flow state; when Authlib is wired up later they may need
tweaks to match its expected column shapes.
"""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base
from shared.oidc import (
    ClientKind,
    ClientStatus,
    GrantType,
    ResponseType,
    TokenEndpointAuthMethod,
)
from shared.roles import Role


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    oidc_clients: Mapped[list["OIDCClient"]] = relationship(
        back_populates="organization"
    )
    kiosk_devices: Mapped[list["KioskDevice"]] = relationship(
        back_populates="organization"
    )
    claim_definitions: Mapped[list["OrgClaimDefinition"]] = relationship(
        back_populates="organization"
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    display_name: Mapped[str | None] = mapped_column(Text)
    role: Mapped[Role] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    # Org-specific custom claim values. Schema is described by
    # OrgClaimDefinition rows for the same org_id.
    org_attributes: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )

    organization: Mapped[Organization] = relationship(back_populates="users")
    credentials: Mapped[list["UserCredential"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    biometrics: Mapped[list["UserBiometric"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserCredential(Base, TimestampMixin):
    __tablename__ = "user_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    cred_type: Mapped[str] = mapped_column(Text, nullable=False)  # "password" | "totp"
    password_hash: Mapped[str | None] = mapped_column(Text)
    totp_secret: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="credentials")


class UserBiometric(Base, TimestampMixin):
    __tablename__ = "user_biometrics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 512 matches ArcFace/InsightFace embedding dimensionality — revisit when
    # the engine's model choice is finalized.
    face_embedding: Mapped[list[float]] = mapped_column(Vector(512), nullable=False)
    quality: Mapped[float | None] = mapped_column(Float)

    user: Mapped[User] = relationship(back_populates="biometrics")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    ip_addr: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class OIDCClient(Base, TimestampMixin):
    __tablename__ = "oidc_clients"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    secret_hash: Mapped[str | None] = mapped_column(Text)
    redirect_uris: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    grant_types: Mapped[list[GrantType]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    response_types: Mapped[list[ResponseType]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    allowed_scopes: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    audience: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_kind: Mapped[ClientKind] = mapped_column(Text, nullable=False)

    # Display metadata (RFC 7591 S2).
    client_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    logo_uri: Mapped[str | None] = mapped_column(Text)
    client_uri: Mapped[str | None] = mapped_column(Text)
    tos_uri: Mapped[str | None] = mapped_column(Text)
    policy_uri: Mapped[str | None] = mapped_column(Text)
    contacts: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )

    # Lifecycle + security.
    status: Mapped[ClientStatus] = mapped_column(
        Text, nullable=False, default="active", server_default="active"
    )
    token_endpoint_auth_method: Mapped[TokenEndpointAuthMethod] = mapped_column(
        Text, nullable=False
    )
    require_pkce: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    post_logout_redirect_uris: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    backchannel_logout_uri: Mapped[str | None] = mapped_column(Text)

    # Per-client token policy. NULL falls back to the global default.
    access_token_ttl_seconds: Mapped[int | None] = mapped_column(Integer)
    refresh_token_ttl_seconds: Mapped[int | None] = mapped_column(Integer)
    id_token_ttl_seconds: Mapped[int | None] = mapped_column(Integer)
    refresh_token_rotation: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    consent_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    organization: Mapped[Organization] = relationship(back_populates="oidc_clients")
    kiosk_devices: Mapped[list["KioskDevice"]] = relationship(
        back_populates="oidc_client"
    )


class KioskDevice(Base):
    __tablename__ = "kiosk_devices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    hw_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")
    client_id: Mapped[str] = mapped_column(
        Text, ForeignKey("oidc_clients.id", ondelete="RESTRICT"), nullable=False
    )
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    organization: Mapped[Organization] = relationship(back_populates="kiosk_devices")
    oidc_client: Mapped[OIDCClient] = relationship(back_populates="kiosk_devices")


class Scope(Base):
    __tablename__ = "scopes"

    name: Mapped[str] = mapped_column(Text, primary_key=True)
    description: Mapped[str | None] = mapped_column(Text)
    resource: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # admin|entity|biometric
    allowed_roles: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class OrgClaimDefinition(Base, TimestampMixin):
    __tablename__ = "org_claim_definitions"
    __table_args__ = (UniqueConstraint("org_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[str] = mapped_column(Text, nullable=False)  # string|number|boolean
    # Gating scope — the claim is only released when this scope is granted.
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    organization: Mapped[Organization] = relationship(
        back_populates="claim_definitions"
    )


# --- Authlib OAuth2/OIDC grant-flow storage -----------------------------------


class _OAuth2Base:
    signature: Mapped[str] = mapped_column(Text, primary_key=True)
    request_id: Mapped[str] = mapped_column(Text, nullable=False)
    session_data: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class OAuth2AuthCode(Base, _OAuth2Base):
    __tablename__ = "oauth2_auth_codes"

    client_id: Mapped[str] = mapped_column(
        Text, ForeignKey("oidc_clients.id", ondelete="CASCADE"), nullable=False
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class OAuth2AccessToken(Base, _OAuth2Base):
    __tablename__ = "oauth2_access_tokens"

    client_id: Mapped[str] = mapped_column(
        Text, ForeignKey("oidc_clients.id", ondelete="CASCADE"), nullable=False
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class OAuth2RefreshToken(Base, _OAuth2Base):
    __tablename__ = "oauth2_refresh_tokens"

    client_id: Mapped[str] = mapped_column(
        Text, ForeignKey("oidc_clients.id", ondelete="CASCADE"), nullable=False
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class OAuth2PKCE(Base, _OAuth2Base):
    __tablename__ = "oauth2_pkce"


class OAuth2OIDC(Base, _OAuth2Base):
    __tablename__ = "oauth2_oidc"

    client_id: Mapped[str] = mapped_column(
        Text, ForeignKey("oidc_clients.id", ondelete="CASCADE"), nullable=False
    )
