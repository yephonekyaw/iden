import { listOrgUserFields } from "@/lib/api/user-schema";
import { UserSchemaManager } from "./manager";

export default async function UserSchemaPage() {
  const fields = await listOrgUserFields();
  return <UserSchemaManager initialFields={fields} />;
}
