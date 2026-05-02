import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { WorldModel } from "@artemis-glitter/domain";

export function useStatusQuery() {
  return queryOptions({
    queryKey: ["status"],
    queryFn: () => apiFetch<{ state: string; connected: boolean }>("/status"),
  });
}

export function useModelQuery() {
  return queryOptions({
    queryKey: ["model"],
    queryFn: () => apiFetch<WorldModel>("/model"),
  });
}
