# Packet Fixture Corpus

Binary fixtures for the Artemis Spaceship Bridge Simulator network protocol,
used for snapshot and round-trip testing during the TypeScript/Bun/React migration.

## Regenerating

```bash
node test/tools/capture-fixture.cjs
```

To validate without writing files:

```bash
node test/tools/capture-fixture.cjs --dry-run
```

## File Structure

Each fixture has two files:

- `<name>.bin` — Raw binary packet matching the Artemis wire format
- `<name>.json` — Canonical decoded payload for snapshot comparison

### Wire Format (Artemis Packet Protocol)

```
[Header - 24 bytes]
  uint32LE  magic           (0xdeadbeef)
  uint32LE  packetLength    (bytesRemaining + 20)
  uint32LE  origin          (0 = server)
  uint32LE  unknown         (0)
  uint32LE  bytesRemaining  (payload + type field)
  uint32LE  type            (packet type identifier)

[Optional subtype - 1 or 4 bytes depending on packet]

[Payload - variable length per packet type]
```

## Fixture Index

### Server → Client Packets

| Fixture | Packet Type | Subtype | Description |
|---------|-------------|---------|-------------|
| welcome | 0x6d04b3da | — | Server welcome message (ASCII string) |
| version | 0xe548e74a | — | Server version info (Artemis 2.1.5) |
| destroyObject | 0xcc5a3e30 | — | Object removed from play |
| playerUpdate | 0x80803df9 | 0x01 | Player ship status (minimal: id + energy) |
| npcUpdate | 0x80803df9 | 0x05 | NPC ship status (minimal: id + posX) |
| weaponsUpdate | 0x80803df9 | 0x02 | Weapons status (minimal: storesHoming + storesNukes) |
| engineeringUpdate | 0x80803df9 | 0x03 | Engineering status (minimal: heatBeams + energyBeams) |
| allShipSettings | 0xf754c8fe | 0x0f | All 8 player ship configurations |
| gameOverReason | 0xf754c8fe | 0x14 | Game over reason (title + reason strings) |
| gameOverStats | 0xf754c8fe | 0x15 | Game over statistics |

### Edge Cases

| Fixture | Description |
|---------|-------------|
| multi-subpacket | Two playerUpdate subpackets in one frame |
| split-across-chunks | Packet truncated at byte 30 of 32 |
| unknown-type | Valid header with unrecognized type 0xDEADC0DE |
| unknown-subtype | Valid objectUpdate type with unrecognized subtype 0xFF |

### Client → Server Commands

| Fixture | Packet Type | Subtype | Description |
|---------|-------------|---------|-------------|
| out-shipSelect | 0x4c821d3c | 0x0d | Select player ship |
| out-setStation | 0x4c821d3c | 0x0e | Set station assignment |
| out-ready | 0x4c821d3c | 0x0f | Ready up |
| out-loadTube | 0x69cc01d9 | 0x02 | Load torpedo tube |
| out-unloadTube | 0x4c821d3c | 0x09 | Unload torpedo tube |
| out-fireTube | 0x4c821d3c | 0x08 | Fire torpedo tube |
| out-gameMasterMessage | 0x809305a7 | — | Send GM message |
