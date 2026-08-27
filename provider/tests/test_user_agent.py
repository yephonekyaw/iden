"""Reading a User-Agent header. Pure logic — no database, no fixtures."""

import pytest

from provider.shared.user_agent import describe

CHROME_MAC = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
)
SAFARI_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
)
EDGE_WINDOWS = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0"
)
FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (CHROME_MAC, ("Mac", "Chrome 142")),
        (SAFARI_IPHONE, ("iPhone", "Safari 18")),
        (FIREFOX_LINUX, ("Linux", "Firefox 133")),
    ],
)
def test_it_names_the_common_browsers(raw, expected):
    assert describe(raw) == expected


def test_the_most_specific_claim_wins():
    """Every browser claims to be several others. Edge says Chrome and Safari,
    so testing in the wrong order makes the whole world read as Safari."""
    assert describe(EDGE_WINDOWS) == ("Windows", "Edge 141")


def test_an_unknown_agent_is_unnamed_rather_than_wrong():
    """Best effort is the contract: the screen renders a session it cannot
    identify, it does not render a guess."""
    assert describe("curl/8.7.1") == (None, None)


def test_an_absent_header_is_not_an_error():
    assert describe(None) == (None, None)
    assert describe("") == (None, None)
