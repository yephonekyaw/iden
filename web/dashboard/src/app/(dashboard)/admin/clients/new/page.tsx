import { listScopes } from "@/lib/api/scopes";
import { CreateClientWizard } from "./wizard";

export default async function NewClientPage() {
  const scopes = await listScopes();
  return <CreateClientWizard scopes={scopes} />;
}
