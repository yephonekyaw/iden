"""Generate an RSA signing keypair for local development.

Production deployments should mount keys from a secret store instead.
"""

import sys
from datetime import UTC, datetime

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
)

from provider.core.config import settings


def main() -> None:
    key_dir = settings.iden_signing_key_dir
    key_dir.mkdir(parents=True, exist_ok=True)

    # Filename stem becomes the kid; date-stamping makes the newest key sort last,
    # which is how core.crypto picks the active one.
    path = key_dir / f"iden-{datetime.now(UTC):%Y%m%d}.pem"
    if path.exists():
        print(f"Key already exists: {path}")
        return

    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    path.write_bytes(
        key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    )
    path.chmod(0o600)

    print(f"Wrote signing key: {path} (kid: {path.stem})")


if __name__ == "__main__":
    sys.exit(main())
