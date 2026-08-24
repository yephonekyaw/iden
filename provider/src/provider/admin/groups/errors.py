from provider.core.errors import ConflictError, NotFoundError


class GroupNotFound(NotFoundError):
    code = "group_not_found"
    message = "No such group."


class GroupNameTaken(ConflictError):
    code = "group_name_taken"
    message = "A group with this name already exists."


class UnknownRoles(NotFoundError):
    code = "unknown_roles"
    message = "One or more role ids do not exist."


class UnknownUsers(NotFoundError):
    code = "unknown_users"
    message = "One or more user ids do not exist."
