import { useQuery } from "@tanstack/react-query";
import { useApi } from "../../app/api";
import { fetchAll } from "./api";
import type { PickerOption } from "./picker";

/** Every scope in the deployment, grouped for the role and client pickers. */
export function useScopeOptions() {
  const api = useApi();
  return useQuery({
    queryKey: ["all-scopes"],
    queryFn: async () => {
      const apis = await fetchAll<{ id: string; name: string }>(api, "/admin/apis");
      const perApi = await Promise.all(
        apis.map(async (entry) => ({
          apiName: entry.name,
          scopes: await fetchAll<{ id: string; value: string; description: string }>(
            api,
            `/admin/apis/${entry.id}/scopes`,
          ),
        })),
      );
      return perApi.flatMap(({ apiName, scopes }) =>
        scopes.map(
          (scope): PickerOption => ({
            id: scope.id,
            label: scope.description,
            identifier: scope.value,
            hint: apiName,
          }),
        ),
      );
    },
  });
}

export function useRoleOptions() {
  const api = useApi();
  return useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const roles = await fetchAll<{ id: string; name: string; description: string | null }>(
        api,
        "/admin/roles",
      );
      return roles.map(
        (role): PickerOption => ({
          id: role.id,
          label: role.name,
          hint: role.description ?? undefined,
        }),
      );
    },
  });
}
