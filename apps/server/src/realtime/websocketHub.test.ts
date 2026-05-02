import { describe, test, expect } from "bun:test";
import { WebSocketHub } from "./websocketHub";

class MockWebSocket {
  messages: string[] = [];
  send(data: string) {
    this.messages.push(data);
  }
}

describe("WebSocketHub", () => {
  test("publish sends to subscribers only", () => {
    const hub = new WebSocketHub();
    const ws1 = new MockWebSocket();
    const ws2 = new MockWebSocket();

    hub.subscribe(ws1 as never, "model");
    hub.subscribe(ws2 as never, "connection");

    hub.publish("model", { connected: true });

    expect(ws1.messages).toHaveLength(1);
    expect(ws2.messages).toHaveLength(0);
  });

  test("unsubscribe removes subscriber", () => {
    const hub = new WebSocketHub();
    const ws = new MockWebSocket();

    hub.subscribe(ws as never, "model");
    hub.unsubscribe(ws as never, "model");
    hub.publish("model", {});

    expect(ws.messages).toHaveLength(0);
  });

  test("unsubscribeAll removes from all topics", () => {
    const hub = new WebSocketHub();
    const ws = new MockWebSocket();

    hub.subscribe(ws as never, "model");
    hub.subscribe(ws as never, "connection");
    hub.unsubscribeAll(ws as never);

    hub.publish("model", {});
    hub.publish("connection", {});

    expect(ws.messages).toHaveLength(0);
  });

  test("subscriber counts are accurate", () => {
    const hub = new WebSocketHub();
    const ws1 = new MockWebSocket();
    const ws2 = new MockWebSocket();

    hub.subscribe(ws1 as never, "model");
    hub.subscribe(ws2 as never, "model");

    expect(hub.getSubscriberCount("model")).toBe(2);
    expect(hub.getTotalSubscribers()).toBe(2);
  });
});
