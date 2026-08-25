# Define your profile schema

The fields your organization actually collects. See [Profile fields](../concepts/profile-fields.md)
for why this is defined at runtime rather than shipped.

## A field the organization owns

A student number: set by the registrar, visible to the student, not editable by them, and unique.

```bash
curl -X POST http://localhost:8000/admin/profile-fields \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "key": "student_id",
    "label": "Student number",
    "dataType": "string",
    "required": true,
    "unique": true,
    "userReadable": true,
    "userWritable": false,
    "validators": {"pattern": "^[0-9]{8}$"},
    "displayOrder": 10
  }'
```

## A field the person owns

```bash
curl -X POST http://localhost:8000/admin/profile-fields \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "key": "preferred_name",
    "label": "Preferred name",
    "userWritable": true,
    "displayOrder": 20
  }'
```

The only difference that matters is `userWritable`. It decides which endpoint can write the value:

| | `PATCH /entity/profile` | `PATCH /admin/users/{id}/profile` |
|---|---|---|
| `userWritable: true` | ✅ | ✅ |
| `userWritable: false` | ❌ `422` | ✅ |

## A field only some people have

Bind it to a group and it applies only to members:

```bash
-d '{"key": "enrollment_year", "label": "Year of enrolment",
     "dataType": "integer", "groupId": "<Students group id>",
     "validators": {"min": 1900, "max": 2100}}'
```

Staff never see it. Students see it in `GET /entity/profile/schema`, and a dashboard renders the form
from that response rather than hardcoding your fields into a general-purpose identity provider.

## Releasing a field to applications

By default, no application ever sees a custom field. To release one:

```bash
-d '{"key": "department", "label": "Department",
     "claimName": "department", "claimScope": "profile"}'
```

Now `department` appears in ID tokens and `/oauth2/userinfo` — but only for applications granted the
`profile` permission. Both `claimName` and `claimScope` are required together: a claim with no
permission attached would go to everyone.

Reserved OIDC names (`sub`, `iss`, `aud`, `acr`, `sid`, …) are refused, so a custom field cannot
shadow a claim a token's meaning depends on.

## Setting values

=== "As the person"

    ```bash
    curl -X PATCH http://localhost:8000/entity/profile \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d '{"fields": {"preferred_name": "Sam"}}'
    ```

=== "As an administrator"

    ```bash
    curl -X PATCH http://localhost:8000/admin/users/{id}/profile \
      -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
      -d '{"fields": {"student_id": "12345678"}}'
    ```

Writing a field you may not write is refused with `422`, not ignored — an application should never
believe it saved something it did not.

## What cannot be changed later

`key`, `dataType`, `unique` and `groupId` are absent from the update endpoint on purpose. Each would
rewrite the meaning of values already stored: changing a type cannot recast them, and adding
`unique` to a field that already has duplicates cannot succeed.

Define a new field instead.

!!! warning "Deleting a field deletes every answer to it"
    That is the point — an organization that stops collecting something should stop holding it — but
    there is no undo.
