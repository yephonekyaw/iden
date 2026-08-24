from provider.core.errors import ConflictError, ImmutableError, NotFoundError


class ScopeNotFound(NotFoundError):
    code = "scope_not_found"
    message = "No such scope."


class ScopeValueTaken(ConflictError):
    code = "scope_value_taken"
    message = (
        "This scope value is already defined. Scope values are globally unique — a token "
        "carries them as bare strings, so two APIs cannot share one."
    )


class SystemScopeImmutable(ImmutableError):
    code = "system_scope_immutable"
    message = (
        "IDEN's own scopes cannot be modified or deleted — removing one would lock "
        "the organization out of its own deployment."
    )


class ScopeInUse(ConflictError):
    code = "scope_in_use"
    message = (
        "This scope is still granted to roles, users, or clients. Deleting it would "
        "silently revoke those permissions — pass force=true to proceed."
    )
