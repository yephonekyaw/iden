import { getOrganization } from "@/lib/api/organization";
import { listOrgUserFields } from "@/lib/api/user-schema";
import { OrganizationForm } from "./form";

export default async function OrganizationPage() {
  const [org, fields] = await Promise.all([getOrganization(), listOrgUserFields()]);
  return <OrganizationForm org={org} userFieldCount={fields.length} />;
}
