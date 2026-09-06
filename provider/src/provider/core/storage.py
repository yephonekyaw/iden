"""S3-compatible object storage for enrollment images.

MinIO in development; swappable for S3, R2, or GCS without code changes,
since all of them speak the same API. Only used by the biometric module, and
only constructed when `IDEN_BIOMETRIC_ENABLED` is true.
"""

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from provider.core.config import settings

_client = None


def client():
    """Lazy singleton — constructing a boto3 client opens no connection, but
    there is no reason to build one when biometric is disabled."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.iden_minio_endpoint_url,
            aws_access_key_id=settings.iden_minio_access_key,
            aws_secret_access_key=settings.iden_minio_secret_key,
            config=Config(signature_version="s3v4"),
        )
    return _client


def ensure_bucket() -> None:
    """Create the bucket if it does not exist yet. Called once at startup
    rather than before every upload, since it never changes after that."""
    s3 = client()
    try:
        s3.head_bucket(Bucket=settings.iden_minio_bucket)
    except ClientError:
        s3.create_bucket(Bucket=settings.iden_minio_bucket)


def put_image(object_key: str, data: bytes) -> None:
    client().put_object(
        Bucket=settings.iden_minio_bucket,
        Key=object_key,
        Body=data,
        ContentType="image/jpeg",
    )
