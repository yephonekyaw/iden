"""The documentation has to describe what was actually built.

Three long documents are the project's only reference, and they drift silently:
nothing breaks when a route is added and its table row is not. This is the
cheap half of the problem — every claim below is mechanically checkable against
the running application, so it should be checked rather than remembered.

What is deliberately *not* here: whether the prose is still true. A test cannot
tell that the reasoning next to a design decision has gone stale. It can only
guarantee that nothing is missing outright.
"""

import pathlib
import re

import pytest

from provider.core.app import app
from provider.core.config import Settings
from provider.core.db import Base
from provider.shared import models  # noqa: F401 — registers the tables
from provider.shared.scopes import ADMIN_SCOPES, BIOMETRIC_SCOPES, ENTITY_SCOPES

PROVIDER = pathlib.Path(__file__).resolve().parents[1]
ROOT = PROVIDER.parent

SERVER_README = PROVIDER / "README.md"
PLAN = PROVIDER / "PLAN.md"
ROOT_README = ROOT / "README.md"
DOCS = (SERVER_README, PLAN, ROOT_README)


def text(*paths: pathlib.Path) -> str:
    return "\n".join(path.read_text() for path in paths)


def anywhere() -> str:
    return text(*DOCS)


def placeholders(path: str) -> str:
    """`/admin/users/{user_id}` and `/admin/users/{id}` are the same endpoint.

    The docs name path parameters for a reader; the code names them for
    FastAPI. Comparing them literally would fail on a difference that carries
    no meaning.
    """
    return re.sub(r"\{[^}]+\}", "{}", path)


def test_every_route_appears_in_the_endpoint_reference():
    documented = {
        placeholders(match)
        for match in re.findall(r"`(/[a-zA-Z0-9._\-{}/]+)`", text(SERVER_README))
    }
    missing = sorted(
        path for path in app.openapi()["paths"] if placeholders(path) not in documented
    )

    assert not missing, (
        "these routes exist and are in no table in provider/README.md: "
        f"{missing} — add them to § Endpoint Reference"
    )


def test_every_scope_is_described():
    catalogue = {spec.value for spec in ADMIN_SCOPES + ENTITY_SCOPES + BIOMETRIC_SCOPES}
    docs = anywhere()
    missing = sorted(value for value in catalogue if f"`{value}`" not in docs)

    assert not missing, (
        f"scopes in the catalogue that no document mentions: {missing} — "
        "add them to provider/README.md § System scope catalogue"
    )


def test_every_setting_is_documented():
    """A setting nobody can discover is a setting nobody will set."""
    names = {
        f"IDEN_{field.removeprefix('iden_').upper()}" for field in Settings.model_fields
    }
    docs = anywhere()
    missing = sorted(name for name in names if name not in docs)

    assert not missing, (
        f"settings absent from every document: {missing} — "
        "add them to provider/README.md § Configuration"
    )


def test_every_table_is_in_the_data_model():
    """Checked under all three spellings the documents legitimately use: the
    table name, the ER diagram's `USER_PROFILE_VALUE`, and the class name."""
    docs = anywhere()
    missing = []

    for table in Base.metadata.tables:
        class_name = "".join(part.capitalize() for part in table.rstrip("s").split("_"))
        if not any(name in docs for name in (table, table.upper(), class_name)):
            missing.append(table)

    assert not missing, (
        f"tables described nowhere: {sorted(missing)} — "
        "add them to provider/README.md § Data Model"
    )


def test_every_package_is_in_the_layout():
    packages = {
        path.name
        for path in (PROVIDER / "src/provider").rglob("*")
        if path.is_dir() and path.name != "__pycache__"
    }
    docs = anywhere()
    missing = sorted(name for name in packages if name not in docs)

    assert not missing, (
        f"packages missing from the layout trees: {missing} — "
        "update provider/README.md § Package Layout and PLAN.md § Target package layout"
    )


def test_every_core_module_is_in_the_layout():
    """`core/` is where cross-cutting behaviour hides. A module nobody
    documented is behaviour nobody knows to look for."""
    modules = {
        path.name
        for path in (PROVIDER / "src/provider/core").glob("*.py")
        if path.stem != "__init__"
    }
    docs = anywhere()
    missing = sorted(name for name in modules if name not in docs)

    assert not missing, f"core modules missing from the layout trees: {missing}"


@pytest.mark.parametrize("path", DOCS, ids=lambda p: p.name)
def test_code_fences_are_balanced(path: pathlib.Path):
    """An unclosed fence swallows the rest of the document when rendered."""
    assert path.read_text().count("```") % 2 == 0, (
        f"odd number of fences in {path.name}"
    )


@pytest.mark.parametrize("path", DOCS, ids=lambda p: p.name)
def test_internal_links_resolve(path: pathlib.Path):
    content = path.read_text()
    anchors = {
        re.sub(r"[^a-z0-9 -]", "", heading.lower()).replace(" ", "-")
        for heading in re.findall(r"^#{2,4} (.+)$", content, re.M)
    }
    broken = sorted(set(re.findall(r"\]\(#([a-z0-9-]+)\)", content)) - anchors)

    assert not broken, f"{path.name} links to headings that do not exist: {broken}"


def test_cross_document_links_resolve():
    """The three documents reference each other's sections by anchor."""
    plan_anchors = {
        re.sub(r"[^a-z0-9 -]", "", heading.lower()).replace(" ", "-")
        for heading in re.findall(r"^#{2,4} (.+)$", PLAN.read_text(), re.M)
    }
    broken = {}

    for path in (SERVER_README, ROOT_README):
        referenced = set(re.findall(r"PLAN\.md#([a-z0-9-]+)", path.read_text()))
        if missing := sorted(referenced - plan_anchors):
            broken[path.name] = missing

    assert not broken, f"links into PLAN.md that resolve to nothing: {broken}"
