import { describe, test, expect } from "bun:test";
import type { DecodeResult, EncodeResult } from "./types";

describe("types", () => {
  test("DecodeResult ok variant is discriminated", () => {
    const result: DecodeResult<string> = { kind: "ok", value: "test", bytesConsumed: 10 };
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.value).toBe("test");
    }
  });

  test("DecodeResult incomplete variant is discriminated", () => {
    const result: DecodeResult<never> = { kind: "incomplete", need: 42 };
    expect(result.kind).toBe("incomplete");
    if (result.kind === "incomplete") {
      expect(result.need).toBe(42);
    }
  });

  test("DecodeResult unknown variant is discriminated", () => {
    const result: DecodeResult<never> = {
      kind: "unknown",
      type: 0xdeadc0de,
      subtype: null,
      bytesConsumed: 24,
    };
    expect(result.kind).toBe("unknown");
    if (result.kind === "unknown") {
      expect(result.type).toBe(0xdeadc0de);
    }
  });

  test("DecodeResult malformed variant is discriminated", () => {
    const result: DecodeResult<never> = {
      kind: "malformed",
      reason: "bad magic",
      bytesConsumed: 4,
    };
    expect(result.kind).toBe("malformed");
    if (result.kind === "malformed") {
      expect(result.reason).toBe("bad magic");
    }
  });

  test("EncodeResult ok variant is discriminated", () => {
    const result: EncodeResult = { kind: "ok", buffer: new Uint8Array([1, 2, 3]) };
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.buffer).toHaveLength(3);
    }
  });

  test("EncodeResult error variant is discriminated", () => {
    const result: EncodeResult = { kind: "error", reason: "overflow" };
    expect(result.kind).toBe("error");
  });

  test("exhaustive switch on DecodeResult kind compiles and handles all variants", () => {
    const results: DecodeResult<string>[] = [
      { kind: "ok", value: "a", bytesConsumed: 1 },
      { kind: "incomplete", need: 5 },
      { kind: "unknown", type: 0, subtype: null, bytesConsumed: 0 },
      { kind: "malformed", reason: "test-reason", bytesConsumed: 0 },
    ];

    const kinds = results.map((r) => {
      switch (r.kind) {
        case "ok":
          return "ok";
        case "incomplete":
          return "incomplete";
        case "unknown":
          return "unknown";
        case "malformed":
          return "malformed";
      }
    });

    expect(kinds).toEqual(["ok", "incomplete", "unknown", "malformed"]);
  });
});
