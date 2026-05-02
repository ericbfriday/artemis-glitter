import { describe, test, expect } from "bun:test";
import {
  ConnectBodySchema,
  ShipSelectBodySchema,
  TubeActionBodySchema,
  TubeParamSchema,
  apiOk,
  apiErr,
  type ApiResult,
} from "./apiSchemas";

describe("ApiResult helpers", () => {
  test("apiOk wraps data", () => {
    const result: ApiResult<number> = apiOk(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(42);
  });

  test("apiErr wraps error code", () => {
    const result = apiErr("not-connected", "No Artemis connection");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not-connected");
      expect(result.error.message).toBe("No Artemis connection");
    }
  });
});

describe("ConnectBodySchema", () => {
  test("validates required server field", () => {
    expect(() => ConnectBodySchema.parse({})).toThrow();
    expect(ConnectBodySchema.parse({ server: "10.0.0.1:2010" })).toEqual({
      server: "10.0.0.1:2010",
    });
  });

  test("validates optional retries", () => {
    expect(ConnectBodySchema.parse({ server: "host", retries: 3 })).toEqual({
      server: "host",
      retries: 3,
    });
    expect(() => ConnectBodySchema.parse({ server: "host", retries: 11 })).toThrow();
  });
});

describe("ShipSelectBodySchema", () => {
  test("accepts valid ship index", () => {
    expect(ShipSelectBodySchema.parse({ playerShipIndex: 3 })).toEqual({ playerShipIndex: 3 });
  });

  test("rejects out of range", () => {
    expect(() => ShipSelectBodySchema.parse({ playerShipIndex: 8 })).toThrow();
    expect(() => ShipSelectBodySchema.parse({ playerShipIndex: -1 })).toThrow();
  });
});

describe("TubeActionBodySchema", () => {
  test("accepts valid ordnance", () => {
    expect(TubeActionBodySchema.parse({ ordnance: 2 })).toEqual({ ordnance: 2 });
  });

  test("rejects out of range ordnance", () => {
    expect(() => TubeActionBodySchema.parse({ ordnance: 4 })).toThrow();
  });
});

describe("TubeParamSchema", () => {
  test("coerces string to number", () => {
    expect(TubeParamSchema.parse("3")).toBe(3);
  });

  test("rejects out of range", () => {
    expect(() => TubeParamSchema.parse(6)).toThrow();
  });
});
