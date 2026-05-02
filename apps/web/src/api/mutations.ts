import { mutationOptions } from "@tanstack/react-query";
import { apiFetch } from "./client";

export const connectMutation = mutationOptions({
  mutationFn: (server: string) =>
    apiFetch<{ connecting: boolean }>("/connect", {
      method: "POST",
      body: JSON.stringify({ server }),
    }),
});

export const disconnectMutation = mutationOptions({
  mutationFn: () => apiFetch<{ disconnected: boolean }>("/disconnect", { method: "POST" }),
});

export const shipSelectMutation = mutationOptions({
  mutationFn: (playerShipIndex: number) =>
    apiFetch<{ selected: boolean }>("/ship-select", {
      method: "POST",
      body: JSON.stringify({ playerShipIndex }),
    }),
});

export const tubeLoadMutation = mutationOptions({
  mutationFn: ({ tube, ordnance }: { tube: number; ordnance: number }) =>
    apiFetch<{ loaded: boolean }>(`/tubes/${tube}/load`, {
      method: "POST",
      body: JSON.stringify({ ordnance }),
    }),
});

export const tubeUnloadMutation = mutationOptions({
  mutationFn: (tube: number) =>
    apiFetch<{ unloaded: boolean }>(`/tubes/${tube}/unload`, { method: "POST" }),
});

export const tubeFireMutation = mutationOptions({
  mutationFn: (tube: number) =>
    apiFetch<{ fired: boolean }>(`/tubes/${tube}/fire`, { method: "POST" }),
});
