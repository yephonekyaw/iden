import type { AxiosInstance } from "axios";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { get } from "./client";
import type { components } from "./schema";

export type PageMeta = components["schemas"]["PageMeta"];

/** The envelope every paginated admin list returns. */
export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

/** `limit` defaults to 50 and caps at 200 server-side (`core/schemas.py`). */
export const PAGE_SIZE = 50;

export interface PageParams {
  limit?: number;
  offset?: number;
}

export function usePage<T>(
  client: AxiosInstance,
  url: string,
  params: PageParams & Record<string, unknown> = {},
): UseQueryResult<Page<T>> {
  const query = { limit: PAGE_SIZE, offset: 0, ...params };
  return useQuery({
    queryKey: [url, query],
    queryFn: () => get<Page<T>>(client, url, { params: query }),
    placeholderData: (previous) => previous,
  });
}
