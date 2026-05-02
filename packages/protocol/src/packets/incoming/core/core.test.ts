import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BufferReader } from "../../../BufferReader";
import type { DecodeResult } from "../../../types";
import { welcome } from "./welcome";
import { version } from "./version";
import { destroyObject } from "./destroyObject";
import { playerUpdate } from "./playerUpdate";
import { gameOverReason } from "./gameOverReason";
import { gameOverStats } from "./gameOverStats";

const FIXTURES_DIR = resolve(import.meta.dir, "../../../../../../test/fixtures/packets");

function loadBin(name: string): Buffer {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.bin`));
}

function loadJson<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, `${name}.json`), "utf8")) as T;
}

function decodeFixture<T>(
  def: { decode: (r: BufferReader) => DecodeResult<T>; subtypeLength?: number },
  fixtureName: string,
): T {
  const buf = loadBin(fixtureName);
  const reader = new BufferReader(buf);
  reader.seek(24);

  if (def.subtypeLength === 1) {
    reader.readByte();
  } else if (def.subtypeLength === 4) {
    reader.readUInt32LE();
  }

  const result = def.decode(reader);
  expect(result.kind).toBe("ok");
  return (result as { kind: "ok"; value: T }).value;
}

describe("incoming core packets", () => {
  test("welcome decodes fixture", () => {
    const value = decodeFixture(welcome, "welcome");
    const expected = loadJson<{ str: string }>("welcome");
    expect(value.str).toBe(expected.str);
  });

  test("version decodes fixture", () => {
    const value = decodeFixture(version, "version");
    const expected = loadJson<{ major: number; minor: number; patch: number }>("version");
    expect(value.major).toBe(expected.major);
    expect(value.minor).toBe(expected.minor);
    expect(value.patch).toBe(expected.patch);
  });

  test("destroyObject decodes fixture", () => {
    const value = decodeFixture(destroyObject, "destroyObject");
    const expected = loadJson<{ type: number; id: number }>("destroyObject");
    expect(value.type).toBe(expected.type);
    expect(value.id).toBe(expected.id);
  });

  test("playerUpdate decodes fixture", () => {
    const value = decodeFixture(playerUpdate, "playerUpdate");
    const expected = loadJson<{ id: number; energy: number }>("playerUpdate");
    expect(value.id).toBe(expected.id);
    expect(value.energy).toBeCloseTo(expected.energy, 2);
  });

  test("gameOverReason decodes fixture", () => {
    const value = decodeFixture(gameOverReason, "gameOverReason");
    const expected = loadJson<{ title: string; reason: string }>("gameOverReason");
    expect(value.title).toBe(expected.title);
    expect(value.reason).toBe(expected.reason);
  });

  test("gameOverStats decodes fixture", () => {
    const value = decodeFixture(gameOverStats, "gameOverStats");
    const expected = loadJson<{ column: number; stats: Array<{ count: number; label: string }> }>(
      "gameOverStats",
    );
    expect(value.column).toBe(expected.column);
    expect(value.stats).toHaveLength(expected.stats.length);
    expect(value.stats[0]!.count).toBe(expected.stats[0]!.count);
    expect(value.stats[0]!.label).toBe(expected.stats[0]!.label);
  });
});
