# Coding Style Guide

A concise guide for keeping code consistent, readable, and easy for both humans and coding agents to work with.

## 1. Project Structure

Organize code by responsibility and keep the structure predictable.

Typical backend layout:

```text
app/
├── core/           # config, logging, app setup, shared errors
├── database/       # models, sessions, database utilities
├── dependencies/   # dependency injection and external clients
├── routers/        # HTTP/API endpoints
├── schemas/        # request/response/data schemas
├── services/       # reusable domain logic, only when actually needed
├── tasks/          # background or long-running workflows
└── utils/          # generic reusable helpers
```

Do not create new architectural layers without a clear reason.

Before adding a file, check whether the logic naturally belongs in an existing module.

---

## 2. Keep Code Explicit

Prefer straightforward code over clever abstractions.

Good code should make the execution flow easy to follow:

```text
validate input
→ load data
→ check conditions
→ perform operation
→ save changes
→ return result
```

Avoid unnecessary wrappers, excessive indirection, and abstractions that make simple behavior harder to trace.

---

## 3. Dependency Injection

Use dependency injection for shared/request-scoped resources such as:

- database sessions;
- authenticated users;
- external API clients;
- storage clients;
- reusable authorization checks.

Prefer reusable typed aliases when the framework supports them.

```python
DBSessionDep = Annotated[Session, Depends(get_db_session)]
UserDep = Annotated[User, Depends(get_current_user)]
```

Then use them directly:

```python
async def get_item(
    session: DBSessionDep,
    user: UserDep,
):
    ...
```

Do not manually recreate shared clients or dependencies inside every endpoint.

Request-scoped resources should not be passed into background tasks that may outlive the request. Background tasks should create and clean up their own resources.

---

## 4. Type Hints

Use type hints consistently for:

- function parameters;
- return values;
- public helpers;
- models and schemas;
- dependency providers.

Prefer modern Python syntax:

```python
str | None
list[str]
dict[str, int]
UUID | str
```

Avoid `Any` unless the type genuinely cannot be known.

Types should clarify the code, not make simple code unnecessarily complicated.

---

## 5. Naming and Case Conventions

Use standard Python naming:

```text
snake_case          functions, variables, modules
PascalCase          classes, schemas, enums
UPPER_SNAKE_CASE    constants
```

Example:

```python
MAX_FILE_SIZE = 10_000_000

class SubmissionStatus(StrEnum):
    PENDING = "pending"

def get_submission():
    ...
```

For APIs, keep Python code in `snake_case` even if JSON uses `camelCase`.

Handle casing at the schema/serialization boundary instead of manually converting names throughout the codebase.

---

## 6. Refactoring Style

Do not extract functions just because a block is a few lines long.

Keep small operations inline when they are:

- used only once;
- easy to understand;
- tightly coupled to the surrounding workflow.

Avoid this:

```python
def get_name(user):
    return user.name

def set_status(item):
    item.status = "approved"
```

Prefer:

```python
name = user.name
item.status = SubmissionStatus.APPROVED
```

Extract a function when it:

- is reused;
- has meaningful domain logic;
- hides complex implementation details;
- interacts with another system;
- is independently testable;
- makes the caller significantly easier to understand.

A moderately long but coherent function is better than a workflow split across many trivial helpers.

---

## 7. Keep Functions Cohesive

A function should represent one meaningful operation or workflow.

Prefer flat control flow and early returns:

```python
item = get_item()

if item is None:
    return None

if not item.is_valid:
    return None

process(item)
```

Avoid deeply nested conditionals when guard clauses make the logic clearer.

---

## 8. Async vs Sync

Use `async` only when the underlying operation is asynchronous.

Typical async work:

- HTTP requests;
- async storage clients;
- async file operations;
- other async libraries.

Typical sync work:

- synchronous database drivers;
- normal CPU/local operations;
- synchronous libraries.

Do not make a function async just because its caller is async.

Do not wrap synchronous operations in unnecessary `await` patterns.

---

## 9. Error Handling

Catch exceptions only when you can do something useful with them:

- translate the error;
- add useful context;
- roll back state;
- clean up resources;
- update domain state;
- log the failure meaningfully.

Avoid:

```python
try:
    ...
except Exception:
    pass
```

At API boundaries, return appropriate HTTP errors.

Inside domain logic, prefer domain-specific exceptions instead of coupling everything to HTTP concepts.

---

## 10. Resource Management

Use context managers for resources with a lifecycle:

```python
with SessionLocal() as session:
    ...

async with create_client() as client:
    ...
```

Clean up files, clients, sessions, and other resources deterministically.

Do not rely on garbage collection for important cleanup.

---

## 11. Database Code

Keep database access easy to read.

Prefer direct queries over unnecessary repository wrappers when the query is simple.

```python
item = session.scalar(
    select(Item).where(Item.id == item_id)
)
```

Be aware of N+1 queries. If related data is always needed for a collection, load it intentionally.

Keep transaction boundaries explicit:

```python
session.commit()
```

Roll back when handling failed mutations where necessary.

---

## 12. Schemas and Models

Keep persistence models and API schemas separate.

```text
database model
→ business/domain logic
→ schema
→ API response
```

Do not expose ORM models directly as the public API contract unless that is an intentional design decision.

Use enums instead of repeating magic strings for finite states.

```python
SubmissionStatus.APPROVED
```

instead of:

```python
"approved"
```

---

## 13. Logging

Use the project's configured logger instead of `print()`.

Log meaningful events and useful identifiers:

```python
logger.info(
    "Submission verification completed",
    submission_id=submission.id,
)
```

Use exception logging when a traceback is useful.

Do not log passwords, tokens, secrets, or unnecessarily sensitive payloads.

Avoid noisy logs that provide little debugging value.

---

## 14. Comments and Docstrings

Comments should explain **why**, not restate what the code already says.

Bad:

```python
# Set the status
item.status = SubmissionStatus.APPROVED
```

Useful:

```python
# Existing submissions are reused so a student has only one
# logical submission per requirement.
```

Add docstrings where behavior is non-obvious or part of a reusable public interface.

Do not add boilerplate docstrings to every tiny function.

---

## 15. Imports

Keep imports grouped:

```text
standard library

third-party packages

local project imports
```

Prefer explicit absolute imports within the project.

Avoid wildcard imports.

---

## 16. Keep Changes Focused

When fixing or adding something:

- do not refactor unrelated code;
- do not introduce a new architecture for one feature;
- reuse existing patterns;
- inspect nearby code before creating a new convention.

Consistency with the surrounding code is usually more valuable than introducing a theoretically cleaner pattern in isolation.

---

## 17. Agent Guidelines

When modifying the codebase, coding agents should:

1. Read nearby files before making changes.
2. Follow the existing folder structure and naming style.
3. Reuse existing dependencies, schemas, helpers, and configuration.
4. Keep Python names `snake_case`.
5. Add useful type hints.
6. Keep simple logic inline.
7. Extract only meaningful reusable or complex logic.
8. Prefer flat, readable control flow.
9. Preserve the existing sync/async model.
10. Manage resource lifecycles correctly.
11. Use enums/constants instead of new magic values.
12. Avoid unnecessary architectural layers.
13. Avoid unrelated refactors.
14. Keep error handling and logging consistent with surrounding code.
15. Choose the simplest implementation that remains clear and maintainable.

## Core Principle

Write code that is easy to trace and easy to change.

Prefer:

```text
clear
typed
explicit
consistent
cohesive
```

over:

```text
clever
over-abstracted
deeply layered
prematurely generalized
```

If two approaches are equally correct, prefer the one that another developer can understand faster by reading the code around it.
