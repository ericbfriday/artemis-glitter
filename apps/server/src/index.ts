import type { PacketRegistry } from "@artemis-glitter/protocol";
import {
  createInitialWorldModel,
  applyDomainEvent,
  mapPacketToDomainEvents,
  type WorldModel,
} from "@artemis-glitter/domain";
import type { Config } from "@artemis-glitter/config";
import { ArtemisClient } from "./artemis/client";
import { WebSocketHub, handleWsMessage } from "./realtime/websocketHub";
import { createRouter, matchRoute } from "./http/routes";
import type { ClientEvent } from "./artemis/connectionState";

export function createServer(config: Config, registry: PacketRegistry) {
  const client = new ArtemisClient(registry);
  const hub = new WebSocketHub();
  let model: WorldModel = createInitialWorldModel({ playerShipIndex: config.playerShipIndex });

  client.onEvent((event: ClientEvent) => {
    if (event.kind === "packet") {
      const events = mapPacketToDomainEvents(event.name, event.payload as Record<string, unknown>);
      for (const domainEvent of events) {
        model = applyDomainEvent(model, domainEvent);
      }
      hub.publish("model", model);
    } else if (event.kind === "stateChange") {
      hub.publish("connection", { state: event.detail.current });
    }
  });

  const routes = createRouter({
    client,
    model: () => model,
    hub,
  });

  const server = Bun.serve({
    port: config.tcpPort,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/api/realtime" && req.headers.get("upgrade") === "websocket") {
        server.upgrade(req);
        return new Response("upgrading", { status: 101 });
      }

      const handler = matchRoute(routes, req.method, url.pathname);
      if (handler) {
        return handler(req, { client, model: () => model, hub });
      }

      return new Response("Not Found", { status: 404 });
    },
    websocket: {
      open() {},
      message(ws, raw) {
        if (typeof raw === "string") {
          handleWsMessage(hub, ws, raw);
        }
      },
      close(ws) {
        hub.unsubscribeAll(ws);
      },
    },
  });

  return { server, client, hub };
}
