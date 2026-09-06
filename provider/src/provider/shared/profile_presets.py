"""Ready-made profile fields an administrator can start from.

IDEN ships no profile fields — a university needs `student_id`, a company needs
`employee_id`, and shipping either would make the other's deployment wrong. That
is still true. What was missing is that defining one from scratch means deciding
a key, a type, a validator and two permissions before you have collected a
single value, and most organizations want the same dozen fields.

These are templates, not rows. Nothing here exists in any database until an
administrator posts one, and once posted it is an ordinary field they can edit
or delete like any other.

The opinion worth shipping is **`user_writable`**. Who owns a piece of data is
the hard question and the one people get wrong: a student's preferred name is
theirs to change, their student number is the registrar's. Each preset answers
it, and the answer is the first thing the wizard shows.
"""

from dataclasses import dataclass, field

from provider.shared.enums import FieldType


@dataclass(frozen=True)
class FieldPreset:
    key: str
    label: str
    description: str
    data_type: FieldType
    # Why this field exists, written for the administrator choosing it rather
    # than for the person filling it in.
    rationale: str
    # The grouping the wizard sorts by. Not stored on the field itself.
    category: str
    options: tuple[str, ...] = ()
    required: bool = False
    unique: bool = False
    validators: dict = field(default_factory=dict)
    user_readable: bool = True
    user_writable: bool = False


CONTACT = "Contact"
PERSONAL = "Personal"
ORGANIZATION = "Organization"
EDUCATION = "Education"


PRESETS: tuple[FieldPreset, ...] = (
    # --- Contact -----------------------------------------------------------
    FieldPreset(
        key="phone",
        label="Phone number",
        description="A number we can reach you on.",
        data_type=FieldType.PHONE,
        rationale="Theirs to maintain — an organization that edits someone's own phone number is usually working from stale information.",
        category=CONTACT,
        user_writable=True,
    ),
    FieldPreset(
        key="address",
        label="Address",
        description="Where you live.",
        data_type=FieldType.STRING,
        rationale="Personal data with a real retention cost. Collect it only if something actually posts things.",
        category=CONTACT,
        validators={"max_length": 255},
        user_writable=True,
    ),
    FieldPreset(
        key="emergency_contact",
        label="Emergency contact",
        description="Who to call, and how.",
        data_type=FieldType.STRING,
        rationale="Theirs to keep current. Nobody else knows when it changes.",
        category=CONTACT,
        validators={"max_length": 255},
        user_writable=True,
    ),
    # --- Personal ----------------------------------------------------------
    FieldPreset(
        key="preferred_name",
        label="Preferred name",
        description="What you would like to be called.",
        data_type=FieldType.STRING,
        rationale="The clearest case of something belonging to the person rather than the organization.",
        category=PERSONAL,
        validators={"max_length": 128},
        user_writable=True,
    ),
    FieldPreset(
        key="pronouns",
        label="Pronouns",
        description="How you would like to be referred to.",
        data_type=FieldType.STRING,
        rationale="Theirs, always. An administrator setting this for somebody would be the bug.",
        category=PERSONAL,
        validators={"max_length": 64},
        user_writable=True,
    ),
    FieldPreset(
        key="date_of_birth",
        label="Date of birth",
        description="Your date of birth.",
        data_type=FieldType.DATE,
        rationale="Often a legal record rather than a preference, so it is set by whoever verified it.",
        category=PERSONAL,
    ),
    # --- Organization ------------------------------------------------------
    FieldPreset(
        key="employee_id",
        label="Employee ID",
        description="Your employee number.",
        data_type=FieldType.STRING,
        rationale="Issued by the organization and unique across it. Read-only to its owner, and enforced by a database constraint rather than a check.",
        category=ORGANIZATION,
        unique=True,
        required=True,
    ),
    FieldPreset(
        key="department",
        label="Department",
        description="The department you work in.",
        data_type=FieldType.STRING,
        rationale="Usually owned by an HR system. If one exists, treat this as a copy and write it through the admin API.",
        category=ORGANIZATION,
        validators={"max_length": 128},
    ),
    FieldPreset(
        key="job_title",
        label="Job title",
        description="Your role in the organization.",
        data_type=FieldType.STRING,
        rationale="Organization-owned: a title is a statement the employer makes.",
        category=ORGANIZATION,
        validators={"max_length": 128},
    ),
    FieldPreset(
        key="start_date",
        label="Start date",
        description="When you joined.",
        data_type=FieldType.DATE,
        rationale="A record, not a preference.",
        category=ORGANIZATION,
    ),
    FieldPreset(
        key="office_location",
        label="Office location",
        description="Where you are usually based.",
        data_type=FieldType.STRING,
        rationale="Useful in a directory, and harmless for people to keep current themselves.",
        category=ORGANIZATION,
        validators={"max_length": 128},
        user_writable=True,
    ),
    # --- Education ---------------------------------------------------------
    FieldPreset(
        key="student_id",
        label="Student ID",
        description="Your university-issued student number.",
        data_type=FieldType.STRING,
        rationale="The registrar's, not the student's. Unique, required, and the reason `unique` is a database constraint.",
        category=EDUCATION,
        unique=True,
        required=True,
    ),
    FieldPreset(
        key="faculty",
        label="Faculty",
        description="The faculty you belong to.",
        data_type=FieldType.ENUM,
        rationale="An enum so the values stay comparable. Edit the options to match your institution before creating it.",
        category=EDUCATION,
        options=("Engineering", "Science", "Arts", "Business", "Medicine", "Law"),
    ),
    FieldPreset(
        key="year_of_study",
        label="Year of study",
        description="Which year you are in.",
        data_type=FieldType.INTEGER,
        rationale="Bounded, because an unbounded number field collects typos.",
        category=EDUCATION,
        validators={"min": 1, "max": 8},
    ),
    FieldPreset(
        key="programme",
        label="Programme",
        description="The programme you are enrolled in.",
        data_type=FieldType.STRING,
        rationale="Owned by the institution's student record system.",
        category=EDUCATION,
        validators={"max_length": 128},
    ),
)
