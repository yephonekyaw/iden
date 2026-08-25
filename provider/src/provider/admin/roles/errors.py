from provider.core.errors import ConflictError, ImmutableError, NotFoundError


class RoleNotFound(NotFoundError):
    code = "role_not_found"
    message = "No such role."


class RoleNameTaken(ConflictError):
    code = "role_name_taken"
    message = "A role with this name already exists."


class SystemRoleImmutable(ImmutableError):
    code = "system_role_immutable"
    message = (
        "IDEN's own roles cannot be renamed, deleted, or have their scopes changed."
    )


class RoleInUse(ConflictError):
    code = "role_in_use"
    message = (
        "This role is still assigned to users or groups. Deleting it would revoke "
        "their permissions — pass force=true to proceed."
    )


class UnknownScopes(NotFoundError):
    code = "unknown_scopes"
    message = "One or more scope ids do not exist."
