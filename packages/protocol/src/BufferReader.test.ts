import { describe, test, expect } from "bun:test";
import { BufferReader, BufferReaderRangeError } from "./BufferReader";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURES_DIR = resolve(import.meta.dir, "../../../test/fixtures/packets");

function loadFixture(name: string): Buffer {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.bin`));
}

describe("BufferReader", () => {
  test("readByte reads a single unsigned byte", () => {
    const reader = new BufferReader(new Uint8Array([0x42, 0xff]));
    expect(reader.readByte()).toBe(0x42);
    expect(reader.readByte()).toBe(0xff);
    expect(reader.pointer).toBe(2);
  });

  test("readUInt8 is an alias for readByte", () => {
    const reader = new BufferReader(new Uint8Array([0x07]));
    expect(reader.readUInt8()).toBe(0x07);
  });

  test("readUInt16LE reads a 16-bit little-endian value", () => {
    const reader = new BufferReader(new Uint8Array([0x34, 0x12]));
    expect(reader.readUInt16LE()).toBe(0x1234);
  });

  test("readUInt32LE reads a 32-bit little-endian value", () => {
    const reader = new BufferReader(new Uint8Array([0xef, 0xbe, 0xad, 0xde]));
    expect(reader.readUInt32LE()).toBe(0xdeadbeef);
  });

  test("readInt32LE reads a signed 32-bit value", () => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setInt32(0, -42, true);
    const reader = new BufferReader(new Uint8Array(buf));
    expect(reader.readInt32LE()).toBe(-42);
  });

  test("readFloatLE reads a 32-bit float", () => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, 3.14, true);
    const reader = new BufferReader(new Uint8Array(buf));
    expect(reader.readFloatLE()).toBeCloseTo(3.14, 5);
  });

  test("readUtf16String reads a length-prefixed UTF-16LE string", () => {
    const str = "Hi";
    const buf = Buffer.alloc(4 + str.length * 2 + 2);
    let off = 0;
    buf.writeUInt32LE(str.length + 1, off);
    off += 4;
    for (let i = 0; i < str.length; i++) {
      buf.writeUInt16LE(str.charCodeAt(i), off);
      off += 2;
    }
    buf.writeUInt16LE(0, off);

    const reader = new BufferReader(buf);
    expect(reader.readUtf16String()).toBe("Hi");
  });

  test("readAsciiString reads a length-prefixed ASCII string", () => {
    const str = "Hello";
    const buf = Buffer.alloc(4 + str.length);
    let off = 0;
    buf.writeUInt32LE(str.length, off);
    off += 4;
    for (let i = 0; i < str.length; i++) {
      buf.writeUInt8(str.charCodeAt(i), off);
      off += 1;
    }

    const reader = new BufferReader(buf);
    expect(reader.readAsciiString()).toBe("Hello");
  });

  test("readBitArray reads a bitfield from bytes", () => {
    const reader = new BufferReader(new Uint8Array([0b10000001, 0b01000000]));
    const bits = reader.readBitArray(2);
    expect(bits).toHaveLength(16);
    expect(bits[0]).toBe(true);
    expect(bits[7]).toBe(true);
    expect(bits[14]).toBe(true);
  });

  test("peek reads without advancing pointer", () => {
    const reader = new BufferReader(new Uint8Array([0x10, 0x20]));
    expect(reader.peek()).toBe(0x10);
    expect(reader.pointer).toBe(0);
    expect(reader.peek(1)).toBe(0x20);
    expect(reader.pointer).toBe(0);
  });

  test("seek sets the pointer to an absolute position", () => {
    const reader = new BufferReader(new Uint8Array([0x01, 0x02, 0x03]));
    reader.seek(2);
    expect(reader.readByte()).toBe(0x03);
  });

  test("throws BufferReaderRangeError on read past end", () => {
    const reader = new BufferReader(new Uint8Array([0x01]));
    reader.readByte();
    expect(() => reader.readByte()).toThrow(BufferReaderRangeError);
  });

  test("throws BufferReaderRangeError on peek past end", () => {
    const reader = new BufferReader(new Uint8Array([0x01]));
    expect(() => reader.peek(5)).toThrow(BufferReaderRangeError);
  });

  test("remaining returns bytes left", () => {
    const reader = new BufferReader(new Uint8Array([0x01, 0x02, 0x03]));
    expect(reader.remaining).toBe(3);
    reader.readByte();
    expect(reader.remaining).toBe(2);
  });

  describe("fixture header parsing", () => {
    function parseHeader(buf: Buffer) {
      const r = new BufferReader(buf);
      return {
        magic: r.readUInt32LE(),
        packetLength: r.readUInt32LE(),
        origin: r.readUInt32LE(),
        unknown: r.readUInt32LE(),
        bytesRemaining: r.readUInt32LE(),
        type: r.readUInt32LE(),
      };
    }

    test("welcome.bin header has magic 0xdeadbeef", () => {
      const header = parseHeader(loadFixture("welcome"));
      expect(header.magic).toBe(0xdeadbeef);
      expect(header.packetLength).toBe(header.bytesRemaining + 20);
      expect(header.type).toBe(0x6d04b3da);
    });

    test("version.bin header parses correctly", () => {
      const header = parseHeader(loadFixture("version"));
      expect(header.magic).toBe(0xdeadbeef);
      expect(header.type).toBe(0xe548e74a);
      expect(header.packetLength).toBe(header.bytesRemaining + 20);
    });

    test("destroyObject.bin header parses correctly", () => {
      const header = parseHeader(loadFixture("destroyObject"));
      expect(header.magic).toBe(0xdeadbeef);
      expect(header.type).toBe(0xcc5a3e30);
    });

    test("playerUpdate.bin header has objectUpdate type", () => {
      const header = parseHeader(loadFixture("playerUpdate"));
      expect(header.magic).toBe(0xdeadbeef);
      expect(header.type).toBe(0x80803df9);
    });

    test("all fixtures have valid magic and consistent lengths", () => {
      const fixtures = [
        "welcome",
        "version",
        "destroyObject",
        "playerUpdate",
        "npcUpdate",
        "weaponsUpdate",
        "engineeringUpdate",
        "allShipSettings",
        "gameOverReason",
        "gameOverStats",
        "multi-subpacket",
        "split-across-chunks",
        "unknown-type",
        "unknown-subtype",
        "out-shipSelect",
        "out-setStation",
        "out-ready",
        "out-loadTube",
        "out-unloadTube",
        "out-fireTube",
        "out-gameMasterMessage",
      ];

      for (const name of fixtures) {
        const buf = loadFixture(name);
        const header = parseHeader(buf);
        expect(header.magic).toBe(0xdeadbeef);
        expect(header.packetLength).toBe(header.bytesRemaining + 20);
      }
    });
  });

  describe("fixture payload parsing", () => {
    test("welcome payload reads as ASCII string", () => {
      const buf = loadFixture("welcome");
      const reader = new BufferReader(buf);
      reader.seek(24);
      expect(reader.readAsciiString()).toBe("Artemis");
    });

    test("destroyObject payload reads type and id", () => {
      const buf = loadFixture("destroyObject");
      const reader = new BufferReader(buf);
      reader.seek(24);
      expect(reader.readByte()).toBe(1);
      expect(reader.readUInt32LE()).toBe(42);
    });

    test("version payload reads major/minor/patch", () => {
      const buf = loadFixture("version");
      const reader = new BufferReader(buf);
      reader.seek(24);
      reader.readUInt32LE();
      reader.readUInt32LE();
      expect(reader.readUInt32LE()).toBe(2);
      expect(reader.readUInt32LE()).toBe(1);
      expect(reader.readUInt32LE()).toBe(5);
    });
  });
});
