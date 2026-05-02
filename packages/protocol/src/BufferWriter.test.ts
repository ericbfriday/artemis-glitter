import { describe, test, expect } from "bun:test";
import { BufferWriter, BufferWriterOverflowError } from "./BufferWriter";
import { BufferReader } from "./BufferReader";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dir, "../../../test/fixtures/packets");
const MAGIC = 0xdeadbeef;

function loadFixture(name: string): Buffer {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.bin`));
}

function loadFixtureJson<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, `${name}.json`), "utf8")) as T;
}

describe("BufferWriter", () => {
  test("writeByte writes a single byte", () => {
    const w = new BufferWriter();
    w.writeByte(0x42);
    const buf = w.toBuffer();
    expect(buf).toEqual(new Uint8Array([0x42]));
  });

  test("writeUInt16LE writes in little-endian", () => {
    const w = new BufferWriter();
    w.writeUInt16LE(0x1234);
    expect(w.toBuffer()).toEqual(new Uint8Array([0x34, 0x12]));
  });

  test("writeUInt32LE writes in little-endian", () => {
    const w = new BufferWriter();
    w.writeUInt32LE(0xdeadbeef);
    expect(w.toBuffer()).toEqual(new Uint8Array([0xef, 0xbe, 0xad, 0xde]));
  });

  test("writeFloatLE writes a 32-bit float", () => {
    const w = new BufferWriter();
    w.writeFloatLE(3.14);
    const reader = new BufferReader(w.toBuffer());
    expect(reader.readFloatLE()).toBeCloseTo(3.14, 5);
  });

  test("writeUtf16String writes length-prefixed UTF-16LE with null terminator", () => {
    const w = new BufferWriter();
    w.writeUtf16String("Hi");
    const reader = new BufferReader(w.toBuffer());
    expect(reader.readUtf16String()).toBe("Hi");
  });

  test("writeAsciiString writes length-prefixed ASCII", () => {
    const w = new BufferWriter();
    w.writeAsciiString("Hello");
    const reader = new BufferReader(w.toBuffer());
    expect(reader.readAsciiString()).toBe("Hello");
  });

  test("round-trip: all primitive types survive write then read", () => {
    const w = new BufferWriter();
    w.writeUInt8(0x42);
    w.writeUInt16LE(0x1234);
    w.writeUInt32LE(0xdeadbeef);
    w.writeInt32LE(-42);
    w.writeFloatLE(3.14);

    const r = new BufferReader(w.toBuffer());
    expect(r.readUInt8()).toBe(0x42);
    expect(r.readUInt16LE()).toBe(0x1234);
    expect(r.readUInt32LE()).toBe(0xdeadbeef);
    expect(r.readInt32LE()).toBe(-42);
    expect(r.readFloatLE()).toBeCloseTo(3.14, 5);
  });

  test("patchUInt32LE overwrites at given offset", () => {
    const w = new BufferWriter();
    w.writeUInt32LE(0);
    w.writeUInt32LE(0);
    w.patchUInt32LE(4, 0xdeadbeef);
    const r = new BufferReader(w.toBuffer());
    r.readUInt32LE();
    expect(r.readUInt32LE()).toBe(0xdeadbeef);
  });

  test("auto-grow doubles buffer when needed", () => {
    const w = new BufferWriter(4);
    w.writeUInt32LE(1);
    w.writeUInt32LE(2);
    expect(w.toBuffer().length).toBe(8);
  });

  test("throws BufferWriterOverflowError when exceeding 1 MiB cap", () => {
    const w = new BufferWriter(1024 * 1024 - 1);
    w.pointer = 1024 * 1024 - 1;
    expect(() => w.writeByte(0)).toThrow(BufferWriterOverflowError);
  });

  describe("outgoing fixture reproduction", () => {
    function buildOutPacket(
      type: number,
      subtype: number,
      writePayload: (w: BufferWriter) => void,
    ): Uint8Array {
      const payloadWriter = new BufferWriter();
      writePayload(payloadWriter);
      const payloadBuf = payloadWriter.toBuffer();

      const bytesRemaining = payloadBuf.length + 4 + 4;
      const packetLength = bytesRemaining + 20;

      const header = new BufferWriter(28);
      header.writeUInt32LE(MAGIC);
      header.writeUInt32LE(packetLength);
      header.writeUInt32LE(0);
      header.writeUInt32LE(0);
      header.writeUInt32LE(bytesRemaining);
      header.writeUInt32LE(type);
      header.writeUInt32LE(subtype);

      const result = new BufferWriter(header.pointer + payloadBuf.length);
      result.writeBytes(header.toBuffer());
      result.writeBytes(payloadBuf);
      return result.toBuffer();
    }

    test("out-shipSelect reproduces fixture bytes", () => {
      const expected = loadFixture("out-shipSelect");
      const payload = loadFixtureJson<{ shipIndex: number }>("out-shipSelect");
      const actual = buildOutPacket(0x4c821d3c, 0x0d, (w) => w.writeUInt32LE(payload.shipIndex));
      expect(new Uint8Array(actual)).toEqual(new Uint8Array(expected));
    });

    test("out-ready reproduces fixture bytes", () => {
      const expected = loadFixture("out-ready");
      const actual = buildOutPacket(0x4c821d3c, 0x0f, (w) => w.writeUInt32LE(0));
      expect(new Uint8Array(actual)).toEqual(new Uint8Array(expected));
    });

    test("out-fireTube reproduces fixture bytes", () => {
      const expected = loadFixture("out-fireTube");
      const payload = loadFixtureJson<{ tube: number }>("out-fireTube");
      const actual = buildOutPacket(0x4c821d3c, 0x08, (w) => w.writeUInt32LE(payload.tube));
      expect(new Uint8Array(actual)).toEqual(new Uint8Array(expected));
    });
  });
});
