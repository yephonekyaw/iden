import pytest

from provider.authz.services.pkce import create_challenge, verify_challenge

# RFC 7636 Appendix B.
RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


def test_matches_rfc_test_vector():
    assert create_challenge(RFC_VERIFIER) == RFC_CHALLENGE


def test_challenge_is_unpadded():
    assert "=" not in create_challenge("a" * 43)


def test_verify_accepts_the_matching_verifier():
    assert verify_challenge(RFC_VERIFIER, RFC_CHALLENGE, "S256")


def test_verify_rejects_a_different_verifier():
    assert not verify_challenge("some-other-verifier", RFC_CHALLENGE, "S256")


@pytest.mark.parametrize("method", ["plain", "", "s256", "S512"])
def test_only_s256_is_accepted(method):
    """`plain` offers no protection against an attacker who can read the
    authorization request, so it is rejected rather than supported."""
    assert not verify_challenge(RFC_VERIFIER, RFC_CHALLENGE, method)
