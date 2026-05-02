/**
 * Packet fixture generator for Artemis protocol testing.
 *
 * Hand-authors binary packet fixtures matching the wire format parsed by
 * artemisNet.js. Each fixture has a matching .json file with the decoded
 * payload for snapshot testing.
 *
 * Usage:
 *   node test/tools/capture-fixture.ts          — generate all fixtures
 *   node test/tools/capture-fixture.ts --dry-run — validate without writing
 *
 * Runs under Node 20+ (no external network calls).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const FIXTURE_DIR = path.join(__dirname, "..", "fixtures", "packets");
const MAGIC = 0xdeadbeef;

// ---------------------------------------------------------------------------
// Buffer helpers (mirrors artemisBufferReader write methods)
// ---------------------------------------------------------------------------

class PacketWriter {
  constructor(size) {
    this.buf = Buffer.alloc(size);
    this.pos = 0;
  }

  writeByte(val) {
    this.buf.writeUInt8(val, this.pos);
    this.pos += 1;
    return this;
  }

  writeShort(val) {
    this.buf.writeUInt16LE(val, this.pos);
    this.pos += 2;
    return this;
  }

  writeLong(val) {
    this.buf.writeUInt32LE(val >>> 0, this.pos);
    this.pos += 4;
    return this;
  }

  writeFloat(val) {
    this.buf.writeFloatLE(val, this.pos);
    this.pos += 4;
    return this;
  }

  // UTF-16LE string with length prefix and null terminator (matches artemisBufferReader)
  writeString(str) {
    const charCount = str.length;
    this.writeLong(charCount + 1); // length prefix = chars + 1 (for null)
    for (let i = 0; i < charCount; i++) {
      this.buf.writeUInt16LE(str.charCodeAt(i), this.pos);
      this.pos += 2;
    }
    this.writeShort(0); // null terminator
    return this;
  }

  // ASCII string (welcome packet only)
  writeAsciiString(str) {
    this.writeLong(str.length);
    for (let i = 0; i < str.length; i++) {
      this.buf.writeUInt8(str.charCodeAt(i), this.pos);
      this.pos += 1;
    }
    return this;
  }

  /** Build a complete packet with header + payload. */
  build(type, subtype, subtypeLength) {
    const payloadLen = this.pos;
    const subtypeBytes = subtypeLength || 0;
    const bytesRemaining = payloadLen + subtypeBytes + 4; // +4 for type
    const packetLength = bytesRemaining + 20; // header = 5 uint32s before type

    const header = Buffer.alloc(24 + subtypeBytes);
    let off = 0;
    header.writeUInt32LE(MAGIC, off);
    off += 4;
    header.writeUInt32LE(packetLength, off);
    off += 4;
    header.writeUInt32LE(0, off);
    off += 4; // origin
    header.writeUInt32LE(0, off);
    off += 4; // unknown
    header.writeUInt32LE(bytesRemaining, off);
    off += 4;
    header.writeUInt32LE(type >>> 0, off);
    off += 4;
    if (subtypeLength === 1) {
      header.writeUInt8(subtype, off);
      off += 1;
    } else if (subtypeLength === 4) {
      header.writeUInt32LE(subtype >>> 0, off);
      off += 4;
    }

    return Buffer.concat([header, this.buf.slice(0, payloadLen)]);
  }
}

// ---------------------------------------------------------------------------
// Fixture definitions
// ---------------------------------------------------------------------------

const FIXTURES = [];

function define(name, jsonPayload, buildFn) {
  FIXTURES.push({ name, jsonPayload, buildFn });
}

// --- welcome ---
define("welcome", { str: "Artemis" }, () => {
  const w = new PacketWriter(64);
  w.writeAsciiString("Artemis");
  return w.build(0x6d04b3da, null, 0);
});

// --- version ---
define(
  "version",
  {
    unknown1: 0,
    unknown2: 0,
    major: 2,
    minor: 1,
    patch: 5,
  },
  () => {
    const w = new PacketWriter(32);
    w.writeLong(0); // unknown1
    w.writeLong(0); // unknown2
    w.writeLong(2); // major
    w.writeLong(1); // minor
    w.writeLong(5); // patch
    return w.build(0xe548e74a, null, 0);
  },
);

// --- destroyObject ---
define("destroyObject", { type: 1, id: 42 }, () => {
  const w = new PacketWriter(8);
  w.writeByte(1); // type (player ship)
  w.writeLong(42); // id
  return w.build(0xcc5a3e30, null, 0);
});

// --- playerUpdate (subtype 0x01) ---
// Minimal: only bits for id + energy (bit 0 of byte 0)
define(
  "playerUpdate",
  {
    id: 7,
    energy: 1000.0,
  },
  () => {
    const w = new PacketWriter(64);
    w.writeLong(7); // id
    // 5-byte bitfield: only bit 0 set (energy) = 0x01, 0x00, 0x00, 0x00, 0x00
    w.writeByte(0x01);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeFloat(1000.0); // energy
    return w.build(0x80803df9, 0x01, 1);
  },
);

// --- npcUpdate (subtype 0x05) ---
// Minimal: only posX (bit 0 of byte 0)
define(
  "npcUpdate",
  {
    id: 100,
    posX: -5000.5,
  },
  () => {
    const w = new PacketWriter(64);
    w.writeLong(100); // id
    // 6-byte bitfield: only bit 0 set = 0x01, 0x00 × 5
    w.writeByte(0x01);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeFloat(-5000.5); // posX
    return w.build(0x80803df9, 0x05, 1);
  },
);

// --- weaponsUpdate (subtype 0x02) ---
// Minimal: storesHoming (bit 7) + storesNukes (bit 6)
define(
  "weaponsUpdate",
  {
    id: 7,
    storesHoming: 6,
    storesNukes: 2,
  },
  () => {
    const w = new PacketWriter(64);
    w.writeLong(7); // id
    // 3-byte bitfield: bits 7+6 = 0xC0, rest 0
    w.writeByte(0xc0);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeByte(6); // storesHoming
    w.writeByte(2); // storesNukes
    return w.build(0x80803df9, 0x02, 1);
  },
);

// --- engineeringUpdate (subtype 0x03) ---
// Minimal: heatBeams (bit 7) + energyBeams (bit 15)
define(
  "engineeringUpdate",
  {
    id: 7,
    heatBeams: 0.25,
    energyBeams: 0.75,
  },
  () => {
    const w = new PacketWriter(64);
    w.writeLong(7);
    // 4-byte bitfield: bits 15+7 = 0x8080, rest 0
    w.writeByte(0x80);
    w.writeByte(0x80);
    w.writeByte(0x00);
    w.writeByte(0x00);
    w.writeFloat(0.25); // heatBeams
    w.writeFloat(0.75); // energyBeams
    return w.build(0x80803df9, 0x03, 1);
  },
);

// --- allShipSettings (subtype 0x0f, subtypeLength=4) ---
// 8 player ships, each with minimal data
define(
  "allShipSettings",
  (() => {
    const ships = {};
    for (let i = 0; i < 8; i++) {
      ships[i] = {
        shipType: i === 0 ? 0 : 0,
        driveType: 0,
        unknown: 0,
        name: i === 0 ? "Artemis" : "",
      };
    }
    return ships;
  })(),
  () => {
    // Pre-calculate size: 8 ships × (3 longs + string overhead)
    const w = new PacketWriter(512);
    for (let i = 0; i < 8; i++) {
      w.writeLong(0); // driveType
      w.writeLong(0); // shipType
      w.writeLong(0); // unknown
      w.writeString(i === 0 ? "Artemis" : "");
    }
    return w.build(0xf754c8fe, 0x0f, 4);
  },
);

// --- gameOverReason (subtype 0x14) ---
define(
  "gameOverReason",
  {
    title: "MISSION COMPLETE",
    reason: "All enemies destroyed",
  },
  () => {
    const w = new PacketWriter(128);
    w.writeString("MISSION COMPLETE");
    w.writeString("All enemies destroyed");
    return w.build(0xf754c8fe, 0x14, 4);
  },
);

// --- gameOverStats (subtype 0x15) ---
define(
  "gameOverStats",
  {
    column: 1,
    stats: [
      { count: 10, label: "Enemies Destroyed" },
      { count: 5, label: "Mines Swept" },
    ],
  },
  () => {
    const w = new PacketWriter(256);
    w.writeByte(1); // column
    // First stat
    w.writeByte(0x01); // separator (non-0xCE means more stats)
    w.writeLong(10);
    w.writeString("Enemies Destroyed");
    // Second stat
    w.writeByte(0x01); // separator
    w.writeLong(5);
    w.writeString("Mines Swept");
    // Terminator
    w.writeByte(0xce);
    return w.build(0xf754c8fe, 0x15, 4);
  },
);

// --- multi-subpacket: two playerUpdates in one frame ---
// The wire format for objectUpdate type (0x80803df9) has subpackets:
// each starts with subtype byte, then payload. Terminator = subtype 0x00.
define(
  "multi-subpacket",
  {
    packets: [
      { subtype: 0x01, name: "playerUpdate", data: { id: 1, energy: 800.0 } },
      { subtype: 0x01, name: "playerUpdate", data: { id: 2, energy: 600.0 } },
    ],
  },
  () => {
    // Build the raw subpacket payloads, then wrap with header
    function buildPlayerSub(id, energy) {
      const w = new PacketWriter(32);
      w.writeByte(0x01); // subtype
      w.writeLong(id);
      // 5-byte bitfield: only bit 0 (energy)
      w.writeByte(0x01);
      w.writeByte(0x00);
      w.writeByte(0x00);
      w.writeByte(0x00);
      w.writeByte(0x00);
      w.writeFloat(energy);
      return w.buf.slice(0, w.pos);
    }

    const sub1 = buildPlayerSub(1, 800.0);
    const sub2 = buildPlayerSub(2, 600.0);
    const terminator = Buffer.from([0x00]); // subtype 0 = end of subpackets

    const payload = Buffer.concat([sub1, sub2, terminator]);
    const bytesRemaining = payload.length + 4; // +4 for type
    const packetLength = bytesRemaining + 20;

    const header = Buffer.alloc(24);
    let off = 0;
    header.writeUInt32LE(MAGIC, off);
    off += 4;
    header.writeUInt32LE(packetLength, off);
    off += 4;
    header.writeUInt32LE(0, off);
    off += 4; // origin
    header.writeUInt32LE(0, off);
    off += 4; // unknown
    header.writeUInt32LE(bytesRemaining, off);
    off += 4;
    header.writeUInt32LE(0x80803df9, off);
    off += 4;

    return Buffer.concat([header, payload]);
  },
);

// --- split-across-chunks ---
// A valid destroyObject packet (total 32 bytes) intentionally cut at byte 30.
define(
  "split-across-chunks",
  {
    note: "First 30 bytes of a 32-byte destroyObject packet. Last 2 bytes are missing.",
    fullPacket: { type: 1, id: 99 },
  },
  () => {
    const w = new PacketWriter(8);
    w.writeByte(1); // type
    w.writeLong(99); // id
    const full = w.build(0xcc5a3e30, null, 0);
    return full.slice(0, 30); // cut 2 bytes short
  },
);

// --- unknown-type ---
define(
  "unknown-type",
  {
    note: "Valid header with type=0xDEADC0DE, no payload",
  },
  () => {
    const w = new PacketWriter(0);
    // Override build to use custom type
    const bytesRemaining = 4; // just the type field
    const packetLength = bytesRemaining + 20;
    const header = Buffer.alloc(24);
    let off = 0;
    header.writeUInt32LE(MAGIC, off);
    off += 4;
    header.writeUInt32LE(packetLength, off);
    off += 4;
    header.writeUInt32LE(0, off);
    off += 4;
    header.writeUInt32LE(0, off);
    off += 4;
    header.writeUInt32LE(bytesRemaining, off);
    off += 4;
    header.writeUInt32LE(0xdeadc0de, off);
    off += 4;
    return header;
  },
);

// --- unknown-subtype ---
// Valid type 0x80803df9 (objectUpdate) but subtype 0xFF (unknown)
define(
  "unknown-subtype",
  {
    note: "objectUpdate type with unknown subtype 0xFF, minimal payload",
  },
  () => {
    const w = new PacketWriter(8);
    w.writeByte(0xff); // unknown subtype
    w.writeLong(999); // some payload bytes that won't be parsed correctly
    const payload = w.buf.slice(0, w.pos);

    const bytesRemaining = payload.length + 4;
    const packetLength = bytesRemaining + 20;
    const header = Buffer.alloc(24);
    let off = 0;
    header.writeUInt32LE(MAGIC, off);
    off += 4;
    header.writeUInt32LE(packetLength, off);
    off += 4;
    header.writeUInt32LE(0, off);
    off += 4;
    header.writeUInt32LE(0, off);
    off += 4;
    header.writeUInt32LE(bytesRemaining, off);
    off += 4;
    header.writeUInt32LE(0x80803df9, off);
    off += 4;
    return Buffer.concat([header, payload]);
  },
);

// --- Outgoing client command: shipSelect ---
define("out-shipSelect", { shipIndex: 0 }, () => {
  const w = new PacketWriter(8);
  // subtype first (4 bytes LE)
  // The header builder doesn't handle subtype for client packets,
  // so we manually add it to payload
  // Actually for client packets the subtype is part of the payload area
  // per artemisNet.js logic. Let me re-examine...
  // Client packets use the same header format. subtype is in the subpacket area.
  w.writeLong(0); // shipIndex
  // Build with subtype in header
  return w.build(0x4c821d3c, 0x0d, 4);
});

// --- Outgoing: setStation ---
define("out-setStation", { station: 1, selected: 1 }, () => {
  const w = new PacketWriter(16);
  w.writeLong(1); // station
  w.writeLong(1); // selected
  return w.build(0x4c821d3c, 0x0e, 4);
});

// --- Outgoing: ready ---
define("out-ready", { padding: 0 }, () => {
  const w = new PacketWriter(8);
  w.writeLong(0);
  return w.build(0x4c821d3c, 0x0f, 4);
});

// --- Outgoing: loadTube ---
define("out-loadTube", { tube: 0, ordnance: 0 }, () => {
  const w = new PacketWriter(16);
  w.writeLong(0); // tube
  w.writeLong(0); // ordnance
  return w.build(0x69cc01d9, 0x02, 4);
});

// --- Outgoing: unloadTube ---
define("out-unloadTube", { tube: 2 }, () => {
  const w = new PacketWriter(8);
  w.writeLong(2);
  return w.build(0x4c821d3c, 0x09, 4);
});

// --- Outgoing: fireTube ---
define("out-fireTube", { tube: 0 }, () => {
  const w = new PacketWriter(8);
  w.writeLong(0);
  return w.build(0x4c821d3c, 0x08, 4);
});

// --- Outgoing: gameMasterMessage ---
define(
  "out-gameMasterMessage",
  {
    destination: 0,
    origin: "COMMS",
    body: "Hello world",
  },
  () => {
    const w = new PacketWriter(128);
    w.writeLong(0); // destination (comms channel)
    w.writeString("COMMS"); // origin
    w.writeString("Hello world"); // body
    return w.build(0x809305a7, null, 0);
  },
);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const dryRun = process.argv.includes("--dry-run");
  let generated = 0;

  for (const fixture of FIXTURES) {
    const binData = fixture.buildFn();
    if (!dryRun) {
      fs.writeFileSync(path.join(FIXTURE_DIR, `${fixture.name}.bin`), binData);
      fs.writeFileSync(
        path.join(FIXTURE_DIR, `${fixture.name}.json`),
        JSON.stringify(fixture.jsonPayload, null, 2) + "\n",
      );
    }
    generated++;
    console.log(
      `  ${dryRun ? "[DRY] " : ""}${fixture.name}.bin (${binData.length} bytes) + ${fixture.name}.json`,
    );
  }

  console.log(`\n${generated} fixtures ${dryRun ? "validated" : "generated"}.`);
  process.exit(0);
}

main();
