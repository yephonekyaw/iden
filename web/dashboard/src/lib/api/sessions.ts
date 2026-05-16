import { SESSIONS } from "@/lib/mock-data";
import type { Session_Device } from "@/lib/types";
import { delay } from "./_delay";

export async function listSessions(): Promise<Session_Device[]> {
  return delay(SESSIONS);
}

export async function revokeSession(id: string): Promise<void> {
  const i = SESSIONS.findIndex((s) => s.id === id);
  if (i >= 0) SESSIONS.splice(i, 1);
  return delay(undefined);
}
