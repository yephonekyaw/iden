import { KIOSKS } from "@/lib/mock-data";
import type { Kiosk } from "@/lib/types";
import { delay } from "./_delay";

export async function listKiosks(): Promise<Kiosk[]> {
  return delay(KIOSKS);
}

export async function getKiosk(id: string): Promise<Kiosk | null> {
  return delay(KIOSKS.find((k) => k.id === id) ?? null);
}

export async function createKiosk(input: {
  name: string;
  location: string;
  hw_id: string;
  client_id: string;
}): Promise<Kiosk> {
  const k: Kiosk = {
    id: `ksk_${Math.random().toString(36).slice(2, 10)}`,
    name: input.name,
    location: input.location,
    hw_id: input.hw_id,
    status: "never_connected",
    client_id: input.client_id,
    last_seen_at: null,
    created_at: new Date().toISOString(),
  };
  KIOSKS.unshift(k);
  return delay(k);
}

export async function deleteKiosk(id: string): Promise<void> {
  const i = KIOSKS.findIndex((k) => k.id === id);
  if (i >= 0) KIOSKS.splice(i, 1);
  return delay(undefined);
}
