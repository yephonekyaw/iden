from fastapi import APIRouter, Depends, Response

from provider.authz.recovery import service
from provider.authz.recovery.schemas import PasswordResetConfirm, PasswordResetRequest
from provider.core import ratelimit
from provider.core.db import DBSessionDep
from provider.core.redis import RedisDep
from provider.core.schemas import ErrorResponse

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post(
    "/password-reset",
    status_code=202,
    summary="Ask for a password reset link",
    description=(
        "Always returns `202`, whether or not the address belongs to anyone. A "
        "different answer for an unknown address would turn this endpoint into "
        "a way to discover who has an account here.\n\n"
        "The link is single use and lives fifteen minutes.\n\n"
        "**Required scope:** none — the person asking cannot sign in."
    ),
    responses={
        202: {"description": "Accepted, whether or not anything was sent"},
        429: {"model": ErrorResponse, "description": "Too many requests"},
    },
    dependencies=[Depends(ratelimit.RESET_PER_IP)],
)
async def request_reset(
    body: PasswordResetRequest, session: DBSessionDep, redis: RedisDep
) -> Response:
    # Per address as well as per caller: the endpoint sends mail to someone
    # else, so without this it is a way to bury a person in messages they did
    # not ask for.
    await ratelimit.guard(redis, identity=body.email, **ratelimit.RESET_PER_ADDRESS)
    await ratelimit.record_failure(
        redis,
        ratelimit.RESET_PER_ADDRESS["bucket"],
        body.email,
        window=ratelimit.RESET_PER_ADDRESS["window"],
    )

    await service.request_reset(session, redis, body.email)
    return Response(status_code=202)


@router.post(
    "/password-reset/confirm",
    status_code=204,
    summary="Set a new password with a reset link",
    description=(
        "Spends the token and sets the password. Every refresh token is revoked "
        "and every session ends — whoever prompted the reset may be the reason "
        "it was needed.\n\n"
        "**Required scope:** none."
    ),
    responses={422: {"model": ErrorResponse, "description": "Expired or already used"}},
)
async def confirm_reset(
    body: PasswordResetConfirm, session: DBSessionDep, redis: RedisDep
) -> Response:
    await service.confirm_reset(session, redis, body.token, body.new_password)
    return Response(status_code=204)
