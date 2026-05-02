import { describe, test, expect } from "bun:test";
import { PacketRegistry } from "./registry";
import type { PacketDefinition } from "./types";

function makeDef(name: string, type: number, subtype: number | null): PacketDefinition {
  return {
    name,
    type,
    subtype,
    subtypeLength: 0,
    decode: () => ({ kind: "ok" as const, value: null, bytesConsumed: 0 }),
    encode: null,
  };
}

describe("PacketRegistry", () => {
  test("register and getByType retrieves the definition", () => {
    const reg = new PacketRegistry();
    const def = makeDef("welcome", 0x6d04b3da, null);
    reg.register(def);
    expect(reg.getByType(0x6d04b3da)).toBe(def);
  });

  test("register and getByName retrieves the definition", () => {
    const reg = new PacketRegistry();
    const def = makeDef("welcome", 0x6d04b3da, null);
    reg.register(def);
    expect(reg.getByName("welcome")).toBe(def);
  });

  test("getByType with subtype retrieves the correct definition", () => {
    const reg = new PacketRegistry();
    const player = makeDef("playerUpdate", 0x80803df9, 0x01);
    const npc = makeDef("npcUpdate", 0x80803df9, 0x05);
    reg.register(player);
    reg.register(npc);
    expect(reg.getByType(0x80803df9, 0x01)).toBe(player);
    expect(reg.getByType(0x80803df9, 0x05)).toBe(npc);
  });

  test("duplicate registration throws", () => {
    const reg = new PacketRegistry();
    reg.register(makeDef("welcome", 0x6d04b3da, null));
    expect(() => reg.register(makeDef("welcome2", 0x6d04b3da, null))).toThrow(/Duplicate/);
  });

  test("getByType returns undefined for unknown type", () => {
    const reg = new PacketRegistry();
    expect(reg.getByType(0x00000000)).toBeUndefined();
  });

  test("getByName returns undefined for unknown name", () => {
    const reg = new PacketRegistry();
    expect(reg.getByName("nonexistent")).toBeUndefined();
  });

  test("all returns all registered definitions", () => {
    const reg = new PacketRegistry();
    const a = makeDef("a", 1, null);
    const b = makeDef("b", 2, null);
    reg.register(a);
    reg.register(b);
    expect(reg.all()).toHaveLength(2);
  });
});
