# Conventions

## Code style

- **Choose simplicity.** The shortest readable implementation. Three similar lines beat a premature
  abstraction.
- **Small, focused functions and files.** A function past one clear responsibility gets split.
- **Obvious names over clever ones.**
- **No defensive code for impossible states.** Validate at the boundary — request bodies, external
  APIs. Trust internal callers.
- **Default to no comments.** Comment when the *why* is non-obvious: a hidden constraint, a
  surprising invariant, a workaround. Never narrate what the code does.

That last rule is the one worth internalising. Most comments in this codebase explain a decision that
looks wrong until you know something — why consent records the granted set rather than the requested
one, why `sid` is a hash. Those earn their space. `# increment the counter` does not.

## Feature packages

A resource is a directory with four files, each with one job:

```
admin/users/
├── routes.py      FastAPI handlers. Translate domain errors → HTTP. No database calls.
├── schemas.py     Pydantic DTOs. Validation lives here.
├── service.py     Database logic. FastAPI-free. Raises domain errors.
└── errors.py      Domain exceptions.
```

The split is not ceremony. `service.py` knowing nothing about HTTP is what lets the same code back
`/entity/profile` and `/admin/users/{id}/profile` with opposite permission rules. `routes.py` making
no database calls is what keeps the handlers readable as a description of the endpoint.

Cross-cutting code lives in `core/` (config, database, auth, audit, rate limiting) or `shared/`
(models, enums, the permission catalogue).

## Every endpoint documents itself

`/docs` is the integration surface. An endpoint that does not explain itself there is not finished.

```python
@router.post(
    "",
    response_model=ApiResponse,          # explicit, never inferred
    status_code=201,                     # explicit for non-200 successes
    summary="Register a resource API",   # one line
    description=(                        # richer, markdown, states the permission
        "...\n\n**Required scope:** `admin:apis:write`"
    ),
    responses={409: {"model": ErrorResponse, "description": "Name already in use"}},
    dependencies=[WRITE],
)
```

Use `Literal[...]` for enums so allowed values appear in the schema, and `Field(description=...)` on
anything non-obvious.

## Query parameters are camelCase too

FastAPI does **not** apply Pydantic's alias generator to query parameters. A parameter named
`group_id` is `group_id` on the wire unless you say otherwise, which silently breaks a camelCase API:

```python
group_id: UUID | None = Query(None, alias="groupId")
```

This was a real bug — filters were accepted and ignored, returning unfiltered lists.

## Loading relationships on new objects

SQLAlchemy's async mode cannot lazy-load. A freshly created object has unloaded relationships, and
reading one raises `MissingGreenlet` — an error message that names nothing useful.

```python
session.add(user)
await session.commit()
await session.refresh(user, ["groups", "roles"])   # then they are safe to read
```

Routes rarely hit this because they load users with a query, which triggers the eager `selectin`
strategy. Fixtures and creation paths hit it constantly.
