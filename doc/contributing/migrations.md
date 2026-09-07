# Database migrations

Alembic owns the schema. `scripts/seed.py` only fills it, and refuses to run against a database that
has not been migrated.

## After changing a model

```bash
cd provider
uv run alembic revision --autogenerate -m "what changed"
# read what it produced
uv run alembic upgrade head
```

!!! danger "Read the migration before applying it"
    Autogenerate is reliable for added tables and columns and unreliable for anything it has to
    infer. A renamed column looks like a drop plus an add — and the data in it disappears silently.
    Server defaults and `CHECK` constraints are often missed entirely.

    Every migration in this repository has been hand-corrected after generation. That is normal, not
    a sign something went wrong.

## The correction autogenerate always needs

A `NOT NULL` column with no default. Autogenerate emits:

```python
op.add_column("refresh_tokens", sa.Column("authenticated_at", sa.DateTime(), nullable=False))
```

which fails against any database that already has rows. Three ways out, depending on what the column
means:

=== "Backfill from something"

    ```python
    op.add_column("refresh_tokens", sa.Column("authenticated_at", sa.DateTime(), nullable=True))
    op.execute("UPDATE refresh_tokens SET authenticated_at = created_at")
    op.alter_column("refresh_tokens", "authenticated_at", nullable=False)
    ```

    For a token issued before the column existed, when it was created is the closest record of when
    its owner authenticated.

=== "Server default, then drop it"

    ```python
    op.add_column("clients", sa.Column("flag", sa.Boolean(), nullable=False,
                                       server_default=sa.false()))
    op.alter_column("clients", "flag", server_default=None)
    ```

    Existing rows get `false`; the default afterwards belongs to the model rather than the schema.

=== "Leave it nullable"

    When there is genuinely nothing to backfill with. `refresh_tokens.sid` is nullable because those
    sessions were never recorded — inventing a value would make a token look like it belonged to a
    session that could be signed out.

## The test that catches a forgotten revision

`tests/test_migrations.py` builds a database by running the migrations, then asks autogenerate what
is left to do. Anything it still wants is a revision nobody wrote.

That is why the **test database is built by migrating**, not by `create_all`: two ways to produce the
same schema is one too many, and this is the path a deployment takes.

## A database that predates Alembic

Stamp the initial revision — the tables it creates already exist — then apply everything since:

```bash
uv run alembic stamp 582ce19a8898
uv run alembic upgrade head
uv run python -m scripts.seed
```

Stamping `head` instead would claim every revision is applied and leave the tables the later ones
create missing.

## Generated migrations are formatted

`alembic.ini` runs `ruff check --fix` and `ruff format` as post-write hooks, so a new revision never
arrives already failing the checks.
