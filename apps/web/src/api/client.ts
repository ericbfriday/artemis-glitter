import type { ApiResult } from "@artemis-glitter/shared";

const API_BASE = "/api";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = (await res.json()) as ApiResult<T>;
    return data;
  } catch (err) {
    return { ok: false, error: { code: "network-error", message: String(err) } };
  }
}
