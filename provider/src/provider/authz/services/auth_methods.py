"""The authentication method registry and the acr derivation it feeds.

This is the seam that lets the biometric module add `face` in Phase 4 without
the AuthZ core learning anything about faces: it calls `register()` at import,
and discovery, acr derivation, and the login UI pick it up automatically.
"""

from dataclasses import dataclass

from provider.shared.enums import AcrLevel, AmrMethod


@dataclass(frozen=True)
class MethodSpec:
    name: AmrMethod
    description: str


_registry: dict[AmrMethod, MethodSpec] = {}


def register(spec: MethodSpec) -> None:
    _registry[spec.name] = spec


def supported() -> list[str]:
    return [name.value for name in _registry]


register(MethodSpec(AmrMethod.PWD, "Password"))
register(MethodSpec(AmrMethod.OTP, "Time-based one-time code (RFC 6238)"))


def normalized_amr(amr: list[str]) -> list[str]:
    """The `amr` claim as emitted: RFC 8176 adds `mfa` when two or more
    distinct factors were used."""
    factors = [m for m in amr if m != AmrMethod.MFA]
    if len(set(factors)) >= 2:
        return [*factors, AmrMethod.MFA.value]
    return factors


def derive_acr(amr: list[str]) -> AcrLevel:
    """Assurance level from the methods actually used.

    Derived at issuance rather than stored, so a mid-session step-up upgrades
    the next token with no state to keep in sync.
    """
    factors = {m for m in amr if m != AmrMethod.MFA}

    if AmrMethod.FACE in factors and len(factors) >= 2:
        return AcrLevel.LOA3
    if len(factors) >= 2:
        return AcrLevel.LOA2
    return AcrLevel.LOA1


def meets(acr: AcrLevel, required: str | None) -> bool:
    """Whether a session's level satisfies a client's `acr_values` request.

    Levels are ordered, so loa3 satisfies a request for loa2.
    """
    if not required:
        return True

    order = [AcrLevel.LOA1, AcrLevel.LOA2, AcrLevel.LOA3]
    requested = [AcrLevel(v) for v in required.split() if v in set(AcrLevel)]
    if not requested:
        return True

    return order.index(acr) >= min(order.index(level) for level in requested)
