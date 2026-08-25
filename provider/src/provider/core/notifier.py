"""Delivering a message to a person outside the browser.

One interface with one implementation, which writes to the log. Choosing an
SMTP provider is a deployment decision and a later phase; password recovery
should not wait on it, and a developer needs to see the link anyway.
"""

from provider.core.logging import logger


async def send(*, to: str, subject: str, body: str) -> None:
    """Deliver a message. In development this is the log.

    The address is logged deliberately: in a dev deployment this *is* the
    inbox. A real implementation replaces this function and stops logging the
    body, which contains a single-use token.
    """
    logger.info("Notification", to=to, subject=subject, body=body)
