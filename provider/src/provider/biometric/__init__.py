"""The biometric extension — enrollment, verification, identification, and
liveness, backed by the internal engine (`engine/`).

Importing this package registers the `face` authentication method. That is a
deliberate side effect, not an accident: it is the seam described in
`authz/services/auth_methods.py` that lets this module add `face` without the
AuthZ core knowing anything about faces. Nothing should import this package,
or anything under it, unless `IDEN_BIOMETRIC_ENABLED` is true — `core/router.py`
guards the import, and `authz/login/routes.py` imports it lazily inside the
handler for the same reason. An unconditional import anywhere would advertise
`face` as a supported method even with the module disabled.
"""

from provider.authz.services.auth_methods import MethodSpec, register
from provider.shared.enums import AmrMethod

register(MethodSpec(AmrMethod.FACE, "Facial recognition, liveness-verified"))
