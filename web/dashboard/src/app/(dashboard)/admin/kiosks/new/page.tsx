import { listClients } from "@/lib/api/clients";
import { RegisterKioskForm } from "./form";

export default async function NewKioskPage() {
  const { items } = await listClients({ kind: "kiosk", page_size: 100 });
  return <RegisterKioskForm kioskClients={items.map((c) => ({ id: c.id, name: c.name }))} />;
}
