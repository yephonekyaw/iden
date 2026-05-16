import { ORG } from "@/lib/mock-data";
import type { Organization } from "@/lib/types";
import { delay } from "./_delay";

export async function getOrganization(): Promise<Organization> {
  return delay(ORG);
}

export async function updateOrganization(input: Partial<Organization>): Promise<Organization> {
  Object.assign(ORG, input);
  return delay(ORG);
}
