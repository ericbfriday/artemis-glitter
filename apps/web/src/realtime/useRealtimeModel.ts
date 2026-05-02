import type { WorldModel } from "@artemis-glitter/domain";
import { createInitialWorldModel } from "@artemis-glitter/domain";
import { useSyncExternalStore } from "react";

type Topic = "model" | "connection" | "packets";

interface WsMessage {
  topic: Topic;
  data: unknown;
}

class RealtimeStore {
  private model: WorldModel = createInitialWorldModel({ playerShipIndex: 0 });
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 5000;

  getModel(): WorldModel {
    return this.model;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  connect(url: string): void {
    if (this.ws) return;

    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.ws?.send(JSON.stringify({ topic: "model" }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        if (msg.topic === "model") {
          this.model = msg.data as WorldModel;
          this.notify();
        }
      } catch {
        return;
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect(url);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect(url: string): void {
    this.reconnectTimer = setTimeout(() => {
      this.connect(url);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const store = new RealtimeStore();

export function useRealtimeModel(): WorldModel {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getModel(),
  );
}

export function connectRealtime(): void {
  if (typeof window === "undefined") return;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  store.connect(`${protocol}//${window.location.host}/api/realtime`);
}

export { store as realtimeStore };
