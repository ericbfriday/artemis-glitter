import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shipSelect } from "./shipSelect";
import { setStation } from "./setStation";
import { ready } from "./ready";
import { loadTube } from "./loadTube";
import { unloadTube } from "./unloadTube";
import { fireTube } from "./fireTube";
import { gameMasterMessage } from "./gameMasterMessage";

const FIXTURES_DIR = resolve(import.meta.dir, "../../../../../test/fixtures/packets");

function loadBin(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, `${name}.bin`)));
}

function loadJson<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, `${name}.json`), "utf8")) as T;
}

function assertEncodesTo(
  encode: (w: never, p: never) => { kind: string; buffer?: Uint8Array },
  payload: unknown,
  fixtureName: string,
) {
  const result = encode(undefined as never, payload as never);
  expect(result.kind).toBe("ok");
  const expected = loadBin(fixtureName);
  expect((result as { buffer: Uint8Array }).buffer).toEqual(expected);
}

describe("outgoing packets", () => {
  test("shipSelect encodes to fixture bytes", () => {
    const payload = loadJson<{ shipIndex: number }>("out-shipSelect");
    assertEncodesTo(shipSelect.encode as never, payload, "out-shipSelect");
  });

  test("setStation encodes to fixture bytes", () => {
    const payload = loadJson<{ station: number; selected: number }>("out-setStation");
    assertEncodesTo(setStation.encode as never, payload, "out-setStation");
  });

  test("ready encodes to fixture bytes", () => {
    assertEncodesTo(ready.encode as never, {}, "out-ready");
  });

  test("loadTube encodes to fixture bytes", () => {
    const payload = loadJson<{ tube: number; ordnance: number }>("out-loadTube");
    assertEncodesTo(loadTube.encode as never, payload, "out-loadTube");
  });

  test("unloadTube encodes to fixture bytes", () => {
    const payload = loadJson<{ tube: number }>("out-unloadTube");
    assertEncodesTo(unloadTube.encode as never, payload, "out-unloadTube");
  });

  test("fireTube encodes to fixture bytes", () => {
    const payload = loadJson<{ tube: number }>("out-fireTube");
    assertEncodesTo(fireTube.encode as never, payload, "out-fireTube");
  });

  test("gameMasterMessage encodes to fixture bytes", () => {
    const payload = loadJson<{ destination: number; origin: string; body: string }>(
      "out-gameMasterMessage",
    );
    assertEncodesTo(gameMasterMessage.encode as never, payload, "out-gameMasterMessage");
  });
});
