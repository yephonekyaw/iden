import { USERS } from "@/lib/mock-data";
import type { Paginated, User } from "@/lib/types";
import { delay } from "./_delay";

export async function listUsers(params?: {
  query?: string;
  role?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<Paginated<User>> {
  const page = params?.page ?? 1;
  const page_size = params?.page_size ?? 10;
  const q = params?.query?.toLowerCase().trim();
  let filtered = USERS;
  if (q)
    filtered = filtered.filter(
      (u) => u.display_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  if (params?.role && params.role !== "all") filtered = filtered.filter((u) => u.role === params.role);
  if (params?.status && params.status !== "all") filtered = filtered.filter((u) => u.status === params.status);
  const total = filtered.length;
  const start = (page - 1) * page_size;
  return delay({ items: filtered.slice(start, start + page_size), page, page_size, total });
}

export async function getUser(id: string): Promise<User | null> {
  return delay(USERS.find((u) => u.id === id) ?? null);
}

export async function setUserStatus(id: string, status: User["status"]): Promise<User> {
  const u = USERS.find((u) => u.id === id);
  if (!u) throw new Error("User not found");
  u.status = status;
  return delay(u);
}

export async function setUserRole(id: string, role: User["role"]): Promise<User> {
  const u = USERS.find((u) => u.id === id);
  if (!u) throw new Error("User not found");
  u.role = role;
  return delay(u);
}
