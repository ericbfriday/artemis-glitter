/* eslint-disable @typescript-eslint/require-await */
import { z } from "zod";
import {
  apiOk,
  apiErr,
  ConnectBodySchema,
  ShipSelectBodySchema,
  TubeActionBodySchema,
  TubeParamSchema,
  type ApiResult,
} from "@artemis-glitter/shared";
import type { ArtemisClient } from "../artemis/client";
import type { WorldModel } from "@artemis-glitter/domain";
import type { WebSocketHub } from "../realtime/websocketHub";

export interface RouteContext {
  client: ArtemisClient;
  model: () => WorldModel;
  hub: WebSocketHub;
}

type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response> | Response;

function jsonResponse<T>(result: ApiResult<T>, status = 200): Response {
  return Response.json(result, { status });
}

async function validateBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(apiErr("invalid-json", "Request body must be valid JSON"), 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(apiErr("validation", parsed.error.message), 400);
  }
  return parsed.data;
}

export function createRouter(ctx: RouteContext): Record<string, RouteHandler> {
  return {
    "GET /api/status": () => {
      return jsonResponse(
        apiOk({
          state: ctx.client.getState(),
          connected: ctx.client.getState() === "connected",
        }),
      );
    },

    "GET /api/model": () => {
      return jsonResponse(apiOk(ctx.model()));
    },

    "POST /api/connect": async (req) => {
      const body = await validateBody(req, ConnectBodySchema);
      if (body instanceof Response) return body;

      const [host, portStr] = body.server.split(":");
      const port = Number.parseInt(portStr ?? "2010", 10);

      if (!host) {
        return jsonResponse(apiErr("validation", "Invalid server address"), 400);
      }

      ctx.client.connect(host, port);
      return jsonResponse(apiOk({ connecting: true }));
    },

    "POST /api/disconnect": () => {
      ctx.client.disconnect();
      return jsonResponse(apiOk({ disconnected: true }));
    },

    "POST /api/ship-select": async (req) => {
      const body = await validateBody(req, ShipSelectBodySchema);
      if (body instanceof Response) return body;

      const result = ctx.client.send("shipSelect", { playerShipIndex: body.playerShipIndex });
      if (result.kind === "error") {
        return jsonResponse(apiErr("send-failed", result.reason), 503);
      }
      return jsonResponse(apiOk({ selected: true }));
    },

    "POST /api/tubes/:tube/load": async (req) => {
      const url = new URL(req.url);
      const tubeStr = url.pathname.split("/")[3];
      const tube = TubeParamSchema.safeParse(tubeStr);
      if (!tube.success) {
        return jsonResponse(apiErr("validation", "Tube must be 0-5"), 400);
      }
      const body = await validateBody(req, TubeActionBodySchema);
      if (body instanceof Response) return body;
      const result = ctx.client.send("loadTube", { tube: tube.data, ordnance: body.ordnance });
      if (result.kind === "error") {
        return jsonResponse(apiErr("send-failed", result.reason), 503);
      }
      return jsonResponse(apiOk({ loaded: true }));
    },

    "POST /api/tubes/:tube/unload": async (req) => {
      const url = new URL(req.url);
      const tubeStr = url.pathname.split("/")[3];
      const tube = TubeParamSchema.safeParse(tubeStr);
      if (!tube.success) {
        return jsonResponse(apiErr("validation", "Tube must be 0-5"), 400);
      }
      const result = ctx.client.send("unloadTube", { tube: tube.data });
      if (result.kind === "error") {
        return jsonResponse(apiErr("send-failed", result.reason), 503);
      }
      return jsonResponse(apiOk({ unloaded: true }));
    },

    "POST /api/tubes/:tube/fire": async (req) => {
      const url = new URL(req.url);
      const tubeStr = url.pathname.split("/")[3];
      const tube = TubeParamSchema.safeParse(tubeStr);
      if (!tube.success) {
        return jsonResponse(apiErr("validation", "Tube must be 0-5"), 400);
      }
      const result = ctx.client.send("fireTube", { tube: tube.data });
      if (result.kind === "error") {
        return jsonResponse(apiErr("send-failed", result.reason), 503);
      }
      return jsonResponse(apiOk({ fired: true }));
    },
  };
}

export function matchRoute(
  routes: Record<string, RouteHandler>,
  method: string,
  pathname: string,
): RouteHandler | null {
  if (routes[`${method} ${pathname}`]) return routes[`${method} ${pathname}`] ?? null;

  for (const [pattern, handler] of Object.entries(routes)) {
    const [patMethod, ...pathParts] = pattern.split(" ");
    const patPath = pathParts.join(" ");
    if (patMethod !== method) continue;

    const patSegments = patPath.split("/");
    const reqSegments = pathname.split("/");
    if (patSegments.length !== reqSegments.length) continue;

    let match = true;
    for (let i = 0; i < patSegments.length; i++) {
      if (patSegments[i]!.startsWith(":")) continue;
      if (patSegments[i] !== reqSegments[i]) {
        match = false;
        break;
      }
    }
    if (match) return handler;
  }

  return null;
}
