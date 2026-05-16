import { SCOPES } from "@/lib/mock-data";
import type { Scope } from "@/lib/types";
import { delay } from "./_delay";

export async function listScopes(): Promise<Scope[]> {
  return delay(SCOPES);
}
