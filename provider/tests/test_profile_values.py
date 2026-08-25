"""Unit tests for `shared/profile.py` — validation and casting.

No database and no fixtures: this is the pure logic that decides whether a value
an organization defined is acceptable, and it is shared by the person editing
their own profile and the administrator editing someone else's. A rule that is
wrong here is wrong for both.
"""

import uuid

import pytest

from provider.shared import profile
from provider.shared.enums import FieldType
from provider.shared.models import ProfileField


def field(data_type=FieldType.STRING, **kwargs) -> ProfileField:
    return ProfileField(
        key=kwargs.pop("key", "student_id"),
        label=kwargs.pop("label", "Student ID"),
        data_type=data_type,
        options=kwargs.pop("options", []),
        required=kwargs.pop("required", False),
        validators=kwargs.pop("validators", {}),
        **kwargs,
    )


class TestRequired:
    def test_an_empty_optional_value_is_stored_as_empty(self):
        assert profile.coerce(field(), "") == ""
        assert profile.coerce(field(), None) == ""

    def test_an_empty_required_value_is_refused_by_label(self):
        """The message reaches whoever typed it, so it names the field the way
        the form does — not `student_id`."""
        with pytest.raises(profile.InvalidValue, match="Student ID is required"):
            profile.coerce(field(required=True), "")


class TestTypes:
    @pytest.mark.parametrize(
        ("data_type", "raw", "stored"),
        [
            (FieldType.INTEGER, "42", "42"),
            (FieldType.INTEGER, 42, "42"),
            (FieldType.BOOLEAN, True, "true"),
            (FieldType.BOOLEAN, "FALSE", "false"),
            (FieldType.DATE, "2026-08-25", "2026-08-25"),
            (FieldType.EMAIL, "a@b", "a@b"),
            (FieldType.PHONE, "+66 (0)2 123-4567", "+66 (0)2 123-4567"),
            (FieldType.URL, "https://example.test/x", "https://example.test/x"),
            (FieldType.STRING, 7, "7"),
        ],
    )
    def test_accepted(self, data_type, raw, stored):
        assert profile.coerce(field(data_type), raw) == stored

    @pytest.mark.parametrize(
        ("data_type", "raw"),
        [
            (FieldType.INTEGER, "twelve"),
            (FieldType.INTEGER, "1.5"),
            (FieldType.BOOLEAN, "yes"),
            (FieldType.DATE, "25/08/2026"),
            (FieldType.EMAIL, "not an address"),
            (FieldType.PHONE, "call me"),
            (FieldType.URL, "example.test"),
        ],
    )
    def test_refused(self, data_type, raw):
        with pytest.raises(profile.InvalidValue):
            profile.coerce(field(data_type), raw)

    def test_an_enum_lists_what_was_allowed(self):
        """A refusal that does not say what would have worked sends the user
        back to an administrator."""
        staff = field(FieldType.ENUM, options=["staff", "student"])

        assert profile.coerce(staff, "staff") == "staff"
        with pytest.raises(profile.InvalidValue, match="staff, student"):
            profile.coerce(staff, "alumnus")


class TestValidators:
    def test_pattern(self):
        f = field(validators={"pattern": r"^\d{8}$"})

        assert profile.coerce(f, "12345678") == "12345678"
        with pytest.raises(profile.InvalidValue, match="expected format"):
            profile.coerce(f, "123")

    def test_length_bounds(self):
        f = field(validators={"min_length": 3, "max_length": 5})

        assert profile.coerce(f, "abcd") == "abcd"
        with pytest.raises(profile.InvalidValue, match="at least 3"):
            profile.coerce(f, "ab")
        with pytest.raises(profile.InvalidValue, match="at most 5"):
            profile.coerce(f, "abcdef")

    def test_numeric_bounds_apply_to_the_number_not_the_text(self):
        """`min`/`max` on an integer field compare numerically. Comparing the
        stored text would make 9 larger than 10."""
        f = field(FieldType.INTEGER, validators={"min": 9, "max": 10})

        assert profile.coerce(f, 10) == "10"
        with pytest.raises(profile.InvalidValue, match="at least 9"):
            profile.coerce(f, 8)
        with pytest.raises(profile.InvalidValue, match="at most 10"):
            profile.coerce(f, 11)

    def test_a_zero_bound_is_still_a_bound(self):
        """`min: 0` is falsy. Written as a truthiness check it would be
        silently ignored."""
        f = field(FieldType.INTEGER, validators={"min": 0})

        with pytest.raises(profile.InvalidValue, match="at least 0"):
            profile.coerce(f, -1)


class TestRender:
    @pytest.mark.parametrize(
        ("data_type", "stored", "rendered"),
        [
            (FieldType.INTEGER, "42", 42),
            (FieldType.BOOLEAN, "true", True),
            (FieldType.BOOLEAN, "false", False),
            (FieldType.STRING, "abc", "abc"),
            (FieldType.DATE, "2026-08-25", "2026-08-25"),
        ],
    )
    def test_stored_text_comes_back_as_the_declared_type(
        self, data_type, stored, rendered
    ):
        assert profile.render(field(data_type), stored) == rendered

    def test_unset_is_null_not_empty_string(self):
        """A client reading a profile should see `null` for a field nobody has
        filled in, not an empty string that looks like an answer."""
        assert profile.render(field(), "") is None


class TestApplies:
    def test_an_unbound_field_belongs_to_everyone(self):
        assert profile.applies_to(field(), set())

    def test_a_bound_field_belongs_only_to_the_group(self):
        students = uuid.uuid4()
        f = field(group_id=students)

        assert profile.applies_to(f, {students})
        assert not profile.applies_to(f, {uuid.uuid4()})


def test_reserved_claims_cover_the_ones_that_would_forge_a_token():
    """A custom field mapped onto `sub` or `iss` would let an administrator
    change what a token means."""
    assert {"sub", "iss", "aud", "exp", "scope"} <= profile.RESERVED_CLAIMS
