import { ORG_USER_FIELDS, USER_ATTRIBUTES } from "@/lib/mock-data";
import type { OrgUserField, UserAttributes } from "@/lib/types";
import { delay } from "./_delay";

export async function listOrgUserFields(): Promise<OrgUserField[]> {
  return delay([...ORG_USER_FIELDS].sort((a, b) => a.order - b.order));
}

export async function createOrgUserField(
  input: Omit<OrgUserField, "id" | "order">
): Promise<OrgUserField> {
  const field: OrgUserField = {
    ...input,
    id: `fld_${Math.random().toString(36).slice(2, 10)}`,
    order: ORG_USER_FIELDS.length,
  };
  ORG_USER_FIELDS.push(field);
  return delay(field);
}

export async function updateOrgUserField(
  id: string,
  patch: Partial<Omit<OrgUserField, "id">>
): Promise<OrgUserField> {
  const f = ORG_USER_FIELDS.find((x) => x.id === id);
  if (!f) throw new Error("Field not found");
  Object.assign(f, patch);
  return delay(f);
}

export async function deleteOrgUserField(id: string): Promise<void> {
  const i = ORG_USER_FIELDS.findIndex((x) => x.id === id);
  if (i >= 0) ORG_USER_FIELDS.splice(i, 1);
  return delay(undefined);
}

export async function reorderOrgUserFields(orderedIds: string[]): Promise<void> {
  orderedIds.forEach((id, i) => {
    const f = ORG_USER_FIELDS.find((x) => x.id === id);
    if (f) f.order = i;
  });
  return delay(undefined);
}

export async function getUserAttributes(userId: string): Promise<UserAttributes> {
  return delay(USER_ATTRIBUTES[userId] ?? {});
}

export async function setUserAttributes(
  userId: string,
  attrs: UserAttributes
): Promise<UserAttributes> {
  USER_ATTRIBUTES[userId] = { ...(USER_ATTRIBUTES[userId] ?? {}), ...attrs };
  return delay(USER_ATTRIBUTES[userId]);
}
