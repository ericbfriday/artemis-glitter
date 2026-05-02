import type { ServerWebSocket } from "bun";

export type Topic = "model" | "connection" | "packets";

interface ClientMessage {
  topic: Topic;
}

export class WebSocketHub {
  private subscribers = new Map<Topic, Set<ServerWebSocket<unknown>>>();

  subscribe(ws: ServerWebSocket<unknown>, topic: Topic): void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(ws);
  }

  unsubscribe(ws: ServerWebSocket<unknown>, topic: Topic): void {
    this.subscribers.get(topic)?.delete(ws);
  }

  unsubscribeAll(ws: ServerWebSocket<unknown>): void {
    for (const set of this.subscribers.values()) {
      set.delete(ws);
    }
  }

  publish(topic: Topic, data: unknown): void {
    const subscribers = this.subscribers.get(topic);
    if (!subscribers) return;
    const message = JSON.stringify({ topic, data });
    for (const ws of subscribers) {
      ws.send(message);
    }
  }

  getSubscriberCount(topic: Topic): number {
    return this.subscribers.get(topic)?.size ?? 0;
  }

  getTotalSubscribers(): number {
    let count = 0;
    for (const set of this.subscribers.values()) {
      count += set.size;
    }
    return count;
  }
}

export function handleWsMessage(
  hub: WebSocketHub,
  ws: ServerWebSocket<unknown>,
  message: string,
): void {
  let parsed: ClientMessage | undefined;
  try {
    parsed = JSON.parse(message) as ClientMessage;
  } catch {
    return;
  }
  if (parsed?.topic) {
    hub.subscribe(ws, parsed.topic);
  }
}
