import { ADMIN_SESSION_USER } from "@/lib/mock-data";
import { getUserAttributes, listOrgUserFields } from "@/lib/api/user-schema";
import { ProfileForm } from "./form";

export default async function ProfilePage() {
  const [fields, attributes] = await Promise.all([
    listOrgUserFields(),
    getUserAttributes(ADMIN_SESSION_USER.id),
  ]);
  return <ProfileForm fields={fields} initialAttributes={attributes} />;
}
