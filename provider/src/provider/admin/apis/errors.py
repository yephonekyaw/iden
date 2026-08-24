from provider.core.errors import ConflictError, ImmutableError, NotFoundError


class ApiNotFound(NotFoundError):
    code = "api_not_found"
    message = "No such resource API."


class ApiNameTaken(ConflictError):
    code = "api_name_taken"
    message = "An API with this name already exists."


class AudienceTaken(ConflictError):
    code = "audience_taken"
    message = "An API with this audience already exists."


class SystemApiImmutable(ImmutableError):
    code = "system_api_immutable"
    message = "IDEN's own APIs cannot be modified or deleted."


class ApiInUse(ConflictError):
    code = "api_in_use"
    message = (
        "This API's scopes are still granted to roles, users, or clients. "
        "Deleting it would silently strip those permissions — pass force=true to proceed."
    )
