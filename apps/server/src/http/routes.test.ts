import { describe, test, expect } from "bun:test";
import { matchRoute } from "./routes";

const mockHandler = () => new Response("ok");

describe("matchRoute", () => {
  test("matches exact routes", () => {
    const routes = { "GET /api/status": mockHandler };
    const handler = matchRoute(routes, "GET", "/api/status");
    expect(handler).toBe(mockHandler);
  });

  test("matches parametric routes", () => {
    const routes = { "POST /api/tubes/:tube/load": mockHandler };
    const handler = matchRoute(routes, "POST", "/api/tubes/3/load");
    expect(handler).toBe(mockHandler);
  });

  test("returns null for unmatched routes", () => {
    const routes = { "GET /api/status": mockHandler };
    const handler = matchRoute(routes, "GET", "/api/unknown");
    expect(handler).toBeNull();
  });

  test("differentiates methods", () => {
    const routes = { "GET /api/status": mockHandler };
    const handler = matchRoute(routes, "POST", "/api/status");
    expect(handler).toBeNull();
  });
});
