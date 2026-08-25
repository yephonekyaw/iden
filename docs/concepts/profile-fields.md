# Profile fields

IDEN ships three facts about a person: email, username, display name. Everything else your
organization records is defined **by your organization, at runtime**.

A university needs `student_id`, `department`, `enrollment_year`. A company needs `employee_id`,
`cost_centre`, `manager`. Shipping either set would make the other deployment wrong, so IDEN ships
neither and gives administrators the same tool they use for permissions: define what you need, when
you need it.

## The decision that matters: who may write it

Every field carries two flags:

| Flag | Meaning |
|---|---|
| `userReadable` | The person can see it |
| `userWritable` | The person can change it |

`userWritable` **is** the self-service surface. `PATCH /entity/profile` has no fixed field list — it
accepts exactly the fields marked writable, and refuses anything else rather than ignoring it, so an
application never believes it saved something it did not.

The same values are writable by an administrator through `PATCH /admin/users/{id}/profile`, which is
*not* held to the flag. Being able to write what the field's owner cannot is precisely what
`userWritable: false` means.

So: the registrar sets `student_id` and the student cannot. `preferred_name` is the student's own.
Same table, same endpoints, opposite permissions.

## Different people, different forms

A field bound to a group applies only to its members. Students get `student_id`; staff get
`employee_id`; nobody gets a form full of fields that do not apply to them.

That is why there is no separate "user type" concept — groups already exist, and reusing them means
one thing to understand instead of two.

`GET /entity/profile/schema` returns the fields that apply to *this* person, in display order, so a
dashboard renders its form from data rather than hardcoding one organization's fields into a
general-purpose identity provider.

## Types and validation

`string`, `integer`, `boolean`, `date`, `enum`, `email`, `phone`, `url` — plus optional rules:
`pattern`, `min`, `max`, `minLength`, `maxLength`.

Validation happens at the boundary, and the message names the field so a form can put the error next
to the box that caused it.

## Uniqueness is a database constraint

A field marked `unique` gets a real partial unique index. Two students **must not** end up sharing a
number, and checking "is this taken?" in application code before writing loses that race under load.

This is the main reason values live in a table rather than a JSON column on the user:

| Reason | Detail |
|---|---|
| Uniqueness | Needs a database constraint. In JSON that means creating an index per field at runtime — schema changes triggered by an API call. |
| Filtering | "Everyone in Computer Science" should be an indexed query, not a scan. |
| Renaming | Values reference the field's id, so changing a key rewrites one row instead of every profile. |

The cost is text storage with a cast at the edges, and one extra query per profile read. Keycloak's
`USER_ATTRIBUTE` table has the same shape for the same reasons.

## Releasing a field into tokens

A field is **invisible to applications** until someone maps it — and then only reaches applications
holding the permission it was mapped under.

Set `claimName` (what it is called in the token) and `claimScope` (the permission required to receive
it). Both, or neither: a claim with no permission attached would go to everyone.

`claimName` is checked against the reserved OIDC names — `sub`, `iss`, `aud`, `acr`, `sid` and the
rest — so a custom field can never shadow a claim the meaning of a token depends on.

The default is silence. An organization can collect whatever it needs internally without leaking any
of it to the applications people sign into.
