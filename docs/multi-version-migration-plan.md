# Multi-Version Migration Plan: Artemis 2.1.1, 2.4.0, and 2.8.0

## Executive Summary

Artemis-glitter currently supports only Artemis **2.1.1**. The product goal remains support for three exact server versions:

- **2.1.1**: existing baseline
- **2.4.0**: first popular post-2.3 protocol
- **2.8.0**: current mainstream target

The original plan was directionally correct about the main seam: select protocol behavior at connection time, keep packet decode versioned, and keep the domain model mostly normalized. The revised plan changes five important things:

1. Version detection is now **exact-version and fail-closed**, not "nearest version".
2. Connection bootstrap is now **handshake-safe** and does not hot-swap a decoder that still owns unread bytes.
3. The protocol layer is organized around **packet-family manifests plus versioned wire tables**, not mostly duplicated full registries.
4. The server derives a **capability object** and sends that to the domain/frontend instead of having the frontend infer behavior from hard-coded semver thresholds.
5. Testing expands beyond fixture corpora into **handshake-edge, chunk-boundary, unsupported-version, heartbeat-lifecycle, and max-frame-size** coverage.

This plan touches `packages/protocol`, `packages/domain`, `packages/shared`, `packages/config`, `apps/server`, `apps/web`, and the fake Artemis test harness. Estimated effort is now **25-35 working days** for one engineer already familiar with the codebase.

---

## Current Architecture

```
packages/
  protocol/   Binary wire format (BufferReader/Writer, PacketRegistry, FrameDecoder)
  domain/     WorldModel, DomainEvents, reducer, selectors, vesselData/SNT parsers
  shared/     Zod API schemas
  config/     CLI/env/default config merge

apps/
  server/     Bun.serve HTTP+WS + ArtemisClient (TCP)
  web/        React 19 + TanStack Router/Query SPA

test/
  fixtures/packets/    Binary .bin + decoded .json fixture pairs
  fake-artemis/        Fake TCP server for integration tests
```

Important constraints from the current code:

- `FrameDecoder.feed()` drains **all complete frames in its internal buffer** before returning.
- `FrameDecoder` uses registry lookups to determine whether a packet family has a subtype and how wide that subtype is.
- `ArtemisClient.send()` uses the registry by packet name for outgoing encoders, so replacing only the decoder is not enough.
- `mapPacketToDomainEvents()` and `WorldModel` currently assume a single wire format and use several loose `Record<string, unknown>` shapes.

The current codebase has **zero version awareness**. Every packet definition, subtype number, enum value, bitfield length, and field offset assumes Artemis 2.1.1.

---

## Canonical References

- [artemis-nerds/protocol-docs](https://artemis-nerds.github.io/protocol-docs/) — primary community protocol reference with version annotations
- [rjwut/ian](https://github.com/rjwut/ian) — mature Java Artemis library with per-version support history
- [chrivers/isolinear-chips](https://github.com/chrivers/isolinear-chips) — machine-readable STF specs
- noseynick `parser.pl` and other community parsers — useful for fixture capture and cross-checking

The protocol docs also matter for connect ordering: the normal bootstrap sequence is not just `welcome` then `version`; servers commonly send `ConsoleStatusPacket`, `AllShipSettingsPacket`, and other game-state packets immediately after `VersionPacket`, sometimes in the same TCP read.

---

## Target Versions vs Internal Wire Boundaries

The product target is three exact versions, but the protocol implementation must still account for the release boundaries where the wire format changed.

### Product Targets

- `2.1.1`
- `2.4.0`
- `2.8.0`

### Internal Wire Boundaries That Matter

| Boundary | Why It Matters |
|----------|----------------|
| `2.3.0` | Object type renumbering, console reindexing, ship-number convention change, player object bitfield growth from 5 bytes to 6 bytes |
| `2.4.0` | `AllShipSettings` accent color, GM button packet family, `SetShipSettings` replacement |
| `2.5.106` | Fighter/single-seat flows, `CommsButtonPacket` |
| `2.6.0` | `CommsIncomingPacket` breaking layout change, `GameMasterMessagePacket` recipient changes, weapons layout changes |
| `2.6.3` | Player/NPC/anomaly/weapons field additions, beacon/probe/tag ordnance |
| `2.6.204` | `BeaconConfigPacket`, anomaly type additions |
| `2.7.0` | Creature/jelly/wreck semantics, effect packets, GM message filter changes |
| `2.7.5` | `ClientHeartbeatPacket` becomes required |
| `2.8.0` | Ship-private comms button behavior and final cumulative baseline |

The implementation will not auto-map unknown `2.5.x`, `2.6.x`, or `2.7.x` servers onto `2.8.0`. Those intermediate releases inform code organization and packet-family reuse, but **auto-detection only succeeds for exact supported versions unless an operator explicitly overrides it**.

---

## Wire-Format Audit

The original plan underweighted how many packet families change layout. The protocol work needs to start from an explicit audit, because `CommsIncomingPacket` is not the only incompatible family.

### Packet Families With Known Version Pressure

| Family | Boundaries | Notes |
|-------|------------|-------|
| `playerUpdate` | `2.3.0`, `2.4.0`, `2.6.3` | Bitfield grows from 5 bytes to 6 bytes at `2.3`; additional fields appear later |
| `npcUpdate` | `2.3.0`, `2.6.3`, `2.6.204` | Object renumbering first, later field additions |
| `weaponsUpdate` | `2.1.5`, `2.6.0` | Bit layout changes, later ordnance expansion |
| `anomalyUpdate` | `2.3.0`, `2.6.3`, `2.6.204` | Renumbering plus added anomaly types and fields |
| `nebulaUpdate` / player in-nebula semantics | `2.3.0`, `2.7.0` | Field meaning changes in later versions |
| `consoleStatus` | `2.3.0` | Ship number changes from 1-based to 0-based |
| `allShipSettings` | `2.4.0` | Accent color added |
| `commsIncoming` | `2.6.0` | Channel `int` becomes 2-byte filter bitfield |
| `gameMasterMessage` outgoing | `2.4.0`, `2.6.0`, `2.7.0` | Recipient/presentation/filter changes across versions |
| `clientHeartbeat` outgoing | `2.7.5` | Required lifecycle packet |
| GM button packet family | `2.4.0+` | Entirely absent before `2.4.0` |

### Wire Tables That Must Become Versioned

`objectTypes.ts` alone is not enough. The protocol layer needs versioned manifests for:

- Object types
- Console types
- Ordnance types
- Creature/jelly/wreck types
- Anomaly subtypes
- GM message recipient/filter enums
- Any packet family whose outgoing subtype changed across versions

These tables belong in protocol code, not domain code, and domain code should never use raw numeric IDs.

---

## Architecture Decision

### Chosen Approach: Registry-Per-Supported-Version Composed From Packet-Family Modules

Keep the broad strategy of selecting the protocol profile at connection time, but revise the implementation details:

1. A supported server version resolves to an **exact version profile**: `2.1.1`, `2.4.0`, or `2.8.0`.
2. Each version profile composes packet definitions from **packet-family modules** defined at the wire-change boundaries.
3. The version profile also selects **wire tables** and derives a **capability object**.
4. The connection handshake uses a **dedicated bootstrap decoder** and then instantiates a fresh full-session decoder with leftover bytes replayed.

### Proposed Layout

```
packages/protocol/src/
  version.ts                     ← exact supported versions + raw detected version parsing
  capabilities.ts                ← server-derived capability object
  handshakeDecoder.ts            ← bootstrap-only decoder with leftover replay support
  registry.ts                    ← exact packet defs + family metadata
  frameDecoder.ts                ← steady-state decoder

  packets/
    base/                        ← packets identical across all supported versions
    families/
      incoming/
        objectUpdate/
          player.v211.ts
          player.v230.ts
          player.v240.ts
          player.v263.ts
          npc.v211.ts
          npc.v263.ts
          weapons.v211.ts
          weapons.v260.ts
        commsIncoming.v211.ts
        commsIncoming.v260.ts
        allShipSettings.v211.ts
        allShipSettings.v240.ts
        ...
      outgoing/
        gameMasterMessage.v211.ts
        gameMasterMessage.v240.ts
        gameMasterMessage.v260.ts
        gameMasterMessage.v270.ts
        clientHeartbeat.v275.ts
        ...
    versions/
      v211.ts                    ← manifest for exact Artemis 2.1.1
      v240.ts                    ← manifest for exact Artemis 2.4.0
      v280.ts                    ← manifest for exact Artemis 2.8.0

  wireTables/
    objectTypes.v211.ts
    objectTypes.post230.ts
    consoleTypes.v211.ts
    consoleTypes.post230.ts
    ordnanceTypes.v211.ts
    ordnanceTypes.v263.ts
    creatureTypes.v211.ts
    creatureTypes.v270.ts
    ...
```

### Why This Revision

- It preserves the clean separation between wire protocol and domain logic.
- It avoids large duplicate `v240/` and `v280/` trees where only a few families actually differ.
- It forces every version-sensitive enum table into a named protocol artifact.
- It acknowledges that core protocol infrastructure needs additive changes rather than pretending everything above packet files is already version-ready.

### Core Protocol Invariants

- `BufferReader` and `BufferWriter` remain version-agnostic.
- `PacketDefinition` can stay mostly stable.
- `PacketRegistry` and `FrameDecoder` need additive metadata to handle packet-family dispatch safely.
- No packet decoder should branch on raw semver internally if that can be expressed as version-profile composition.

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Single registry with version-gated decode branches | Fewer files | High decode complexity; version checks spread everywhere | Rejected |
| Full fork per version | Clean isolation | Too much duplication and merge pain | Rejected |
| Separate package per version | Isolation | Poor refactor ergonomics; duplicates infra | Rejected |
| Exact-version registry composed from packet families | Keeps versioning explicit, minimizes duplication, fits current monorepo | Requires manifest discipline and some infra work | Selected |

---

## Exact-Version Policy

### Types

```typescript
export type SupportedArtemisVersion = "2.1.1" | "2.4.0" | "2.8.0";

export interface DetectedArtemisVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}
```

### Rules

1. Parse and preserve the **exact** version announced by the server.
2. Auto-detect only the exact supported versions above.
3. If the server announces an unsupported version, fail closed:
   - emit a structured unsupported-version error
   - refuse to continue decoding with a guessed registry
   - disconnect cleanly
4. Provide a manual override in config/CLI only as an escape hatch for known-bad servers or future testing.
5. If a manual override is supplied and the server later announces a different version, log the mismatch prominently.

This removes the unsafe behavior from the original plan where `2.5.x` through `2.8.x` would all be coerced to `"2.8.0"`.

---

## Handshake-Safe Connection Design

The original hot-swap design is not safe with the current `FrameDecoder`, because the decoder drains all complete frames already buffered before control returns to the caller. If `welcome`, `version`, `consoleStatus`, and `allShipSettings` arrive in the same TCP read, the post-version frames would be decoded with the wrong registry.

### Revised Handshake Strategy

Use a dedicated bootstrap phase instead of mutating a live decoder that still owns unread bytes.

1. Start with a **handshake registry** that only contains packet families needed before version resolution:
   - `welcome`
   - `version`
2. Feed socket bytes into a **HandshakeDecoder** that:
   - decodes packets one frame at a time
   - stops immediately after consuming `VersionPacket`
   - returns any unread bytes from the same socket read as `leftover`
3. Resolve the exact supported version.
4. Build the full version profile:
   - full packet registry
   - versioned wire tables
   - derived capability object
5. Replace **both** `this.registry` and `this.decoder`.
6. Instantiate a fresh `FrameDecoder(fullRegistry)`.
7. Replay `leftover` bytes into the new full decoder before processing further socket reads.

### Pseudocode

```typescript
if (!this.negotiated) {
  const result = this.handshakeDecoder.feed(chunk);
  emitHandshakePackets(result.packets);

  if (result.versionDetected) {
    const profile = buildVersionProfile(result.versionDetected);
    this.registry = profile.registry;
    this.capabilities = profile.capabilities;
    this.decoder = new FrameDecoder(profile.registry);
    this.negotiated = true;

    if (result.leftover.length > 0) {
      this.processFullDecoder(result.leftover);
    }
  }

  return;
}

this.processFullDecoder(chunk);
```

### Why This Is Better Than `setRegistry()`

- No buffered bytes remain owned by the bootstrap decoder after version detection.
- Outgoing commands switch at the same time as incoming decode.
- The logic is deterministic under packet coalescing and chunk splitting.

### Additional Connection Safeguards

- Add a **max frame size** guard before allocating or buffering arbitrarily large frames.
- Clear heartbeat timers and any version-specific state on disconnect and reconnect.
- Surface version-detection failures as API-visible connection errors.

---

## Protocol Capability Derivation

Do not teach the frontend to infer behavior from semver thresholds that only exist in the server's protocol implementation. The server should derive and publish capabilities once the version profile is known.

### Example Shape

```typescript
export interface ProtocolCapabilities {
  exactVersion: SupportedArtemisVersion | null;
  gmButtons: boolean;
  fighterBays: boolean;
  beaconOrdnance: boolean;
  commsFilters: boolean;
  clientHeartbeat: boolean;
  privateCommsButtons: boolean;
}
```

### Rules

- Capabilities are computed server-side from the selected version profile.
- `WorldModel` stores both raw version info and derived capabilities.
- WebSocket/API payloads expose capabilities directly.
- The frontend renders from capabilities, not from its own `versionGte()` logic.

This keeps version thresholds in one place and prevents frontend/server drift.

---

## Domain Boundary

The right rule is not "domain events are version-agnostic" without exception. The right rule is:

- **Normalize into version-agnostic events when semantics are truly equivalent.**
- **Use optional fields when the data is additive.**
- **Use distinct canonical event variants when semantics differ.**

### Good Fits For Simple Normalization

- `ShipSetting` gaining `accentColor?: number`
- New ordnance entries added to the same conceptual weapons inventory
- New effect packets that map cleanly onto existing "visual effect happened" semantics

### Cases That Need Distinct Canonical Shapes

- `commsIncoming` channel integer vs filter bitfield
- GM message recipient/presentation/filter changes
- Fighter/single-seat state
- Creature/jelly/wreck semantics where "same field name" hides different meaning

### Recommended Domain Changes

- Add `protocol` block to `WorldModel`:
  - detected raw version
  - resolved supported version
  - capabilities
- Tighten loose `Record<string, unknown>` payloads for comms and ship settings into named interfaces.
- Add distinct event types where normalization would hide materially different semantics.

---

## Migration Phases

### Phase 0: Protocol Foundation and Version Audit
*Estimated effort: 3-4 days*

**Goal:** Create the exact-version and packet-family foundation needed for safe multi-version work.

#### 0.1 — Add exact version and capability types

- `packages/protocol/src/version.ts`
  - `SupportedArtemisVersion`
  - `DetectedArtemisVersion`
  - exact parser from `VersionPacket`
- `packages/protocol/src/capabilities.ts`
  - `ProtocolCapabilities`
  - capability derivation from supported version profiles

#### 0.2 — Add packet-family metadata to protocol infrastructure

The current decoder needs packet-family metadata before it can read a subtype.

- Extend `PacketRegistry` with family descriptors keyed by packet type:
  - `type`
  - `subtypeLength`
- Add helper methods such as:
  - `registerFamily()`
  - `getFamily(type)`
- Update `FrameDecoder` to ask the family metadata for subtype width instead of assuming the exact packet lookup is enough.

#### 0.3 — Extract bootstrap/full-session decoder split

- Introduce `HandshakeDecoder`
- Refactor common one-frame parsing into shared helpers if useful
- Do **not** implement version negotiation yet; just make the split possible

#### 0.4 — Reorganize packet code by packet family

- Move the current 2.1.1 packet definitions into versioned family modules
- Create empty or stub manifests for `v211`, `v240`, and `v280`
- Add versioned wire-table files, even if only `v211` is populated initially

#### 0.5 — Create a protocol audit document or checklist

Document every packet family that differs across versions before implementation begins. This becomes the worklist for Phases 2 and 3.

#### 0.6 — Preserve behavior

- All current 2.1.1 tests stay green
- No runtime behavior change yet

**Deliverable:** A version-aware protocol foundation exists, the decoder understands packet-family metadata, and the code is ready for handshake-safe version negotiation.

---

### Phase 1: Handshake-Safe Version Negotiation
*Estimated effort: 4-5 days*

**Goal:** Detect exact supported versions safely and instantiate the correct full registry without decoding post-version packets under the wrong profile.

#### 1.1 — Implement bootstrap negotiation in `ArtemisClient`

- Start with `HandshakeDecoder(buildHandshakeRegistry())`
- Stop bootstrap decoding immediately after `VersionPacket`
- Build the full version profile from the exact detected version
- Replace both:
  - `this.registry`
  - `this.decoder`
- Replay leftover bytes into the full decoder

#### 1.2 — Fail closed on unsupported versions

- If auto-detect sees an unsupported exact version, emit an error and disconnect
- Add config/CLI override:
  - `--version 2.1.1|2.4.0|2.8.0`
- Override is opt-in and treated as an operator escape hatch, not default behavior

#### 1.3 — Publish version and capability state

- Add `versionDetected` / `protocolReady` event path
- Thread the protocol block through:
  - domain events
  - `WorldModel`
  - API and WebSocket payloads

#### 1.4 — Add connection-safety guards

- Max frame size limit
- Heartbeat timer cleanup hooks
- Clear protocol state on reconnect

#### 1.5 — Handshake-specific tests

- `welcome` + `version` + `consoleStatus` in one chunk
- `version` split across chunks
- leftover replay after version detection
- unsupported exact version
- manual override mismatch warning

**Deliverable:** Safe exact-version negotiation for `2.1.1`, `2.4.0`, and `2.8.0`, with no unsafe mid-buffer registry swap.

---

### Phase 2: Exact 2.4.0 Support
*Estimated effort: 5-7 days*

**Goal:** Full protocol support for Artemis 2.4.0 using the new family-manifest structure.

#### 2.1 — Populate the `v240` manifest

Compose the `2.4.0` profile from:

- shared base packets
- post-`2.3.0` object/console wire tables
- `2.4.0` packet family variants where layouts changed

#### 2.2 — Implement changed incoming families

- `allShipSettings.v240`
- GM button packet family
- any `ObjectUpdatePacket` family that changed between `2.1.1` and `2.4.0`
- `consoleStatus` normalization for 0-based ship numbering

#### 2.3 — Implement changed outgoing families

- `setShipSettings.v240`
- `buttonClick.v240`
- any GM-related outgoing packets needed by the UI/server flows

#### 2.4 — Domain updates

- `ShipSetting.accentColor?: number`
- GM button domain model and events
- Any tightened payload typing uncovered in Phase 1

#### 2.5 — Fixtures and integration

- Add real or synthetic `2.4.0` fixtures
- Extend fake Artemis scripts for `2.4.0`
- Run full connect/select/play/disconnect flow

**Deliverable:** Exact Artemis `2.4.0` servers work end-to-end, including incoming and outgoing packet families that actually changed.

---

### Phase 3: Exact 2.8.0 Support
*Estimated effort: 6-8 days*

**Goal:** Full protocol support for Artemis 2.8.0, including the cumulative packet-family changes introduced by `2.5.x`, `2.6.x`, `2.7.0`, and `2.7.5`.

#### 3.1 — Populate the `v280` manifest from boundary modules

The `2.8.0` profile should explicitly reuse family modules from the relevant boundaries instead of pretending `v280` is a single monolithic change set.

#### 3.2 — Implement incoming family variants needed by `2.8.0`

- `commsIncoming.v260`
- post-`2.6.3` player/NPC/anomaly/weapons families
- `BeaconConfigPacket`
- effect packets
- creature/jelly/wreck semantics

#### 3.3 — Implement outgoing family variants needed by `2.8.0`

- `clientHeartbeat.v275`
- later `gameMasterMessage` variants
- any fighter/single-seat command packets used by the application

#### 3.4 — Heartbeat lifecycle

- Start only after negotiation resolves to a profile that requires it
- Stop on disconnect
- Stop on reconnect before a new version is negotiated
- Cover timer drift and duplicate-start bugs in tests

#### 3.5 — Domain and capability updates

- fighter/single-seat state
- expanded ordnance inventory
- comms filter model
- private comms button capability

**Deliverable:** Exact Artemis `2.8.0` servers work end-to-end, including `ClientHeartbeatPacket` and later comms/GM behavior.

**Parallelization note:** Phase 3 is only partially parallelizable. It can be split by packet family after the shared manifests and wire tables are in place, but it should not be treated as fully independent from Phase 2.

---

### Phase 4: Frontend Protocol Awareness
*Estimated effort: 2-3 days*

**Goal:** The web UI adapts from server-derived capabilities rather than recalculating version thresholds.

#### 4.1 — Expose protocol block

- `WorldModel.protocol` flows through WebSocket and HTTP APIs
- Optional `GET /api/version` or `GET /api/protocol` endpoint can expose exact version and capabilities

#### 4.2 — Render from capabilities

- GM button panel
- fighter/single-seat controls
- beacon/probe/tag controls
- comms filter UI
- heartbeat status only if operationally useful

#### 4.3 — Keep frontend logic declarative

- no duplicated `versionGte()` matrix in the frontend
- UI checks `model.protocol.capabilities`

**Deliverable:** Frontend behavior tracks the server's negotiated protocol profile without duplicating protocol thresholds.

---

### Phase 5: Testing and Validation
*Estimated effort: 5-8 days*

**Goal:** Build confidence in a reverse-engineered binary protocol across exact target versions and tricky connection boundaries.

#### 5.1 — Fixture corpora per supported exact version

```
test/fixtures/
  packets-v211/
  packets-v240/
  packets-v280/
```

Each corpus should include:

- all incoming packet types used by the application for that exact version
- all outgoing packet types used by the application
- unknown packet types/subtypes
- split-frame and concatenated-frame cases
- version-specific fields populated

#### 5.2 — Focused boundary fixtures for reusable family modules

Examples:

- `playerUpdate.v230.bin`
- `playerUpdate.v240.bin`
- `playerUpdate.v263.bin`
- `commsIncoming.v260.bin`
- `gameMasterMessage.v270.bin`

These do not imply public support for those exact versions; they validate internal family modules reused by the `2.8.0` profile.

#### 5.3 — Handshake-edge tests

- coalesced bootstrap + post-version packets
- version split across chunks
- unsupported exact version
- manual override mismatch
- leftover replay into the full decoder

#### 5.4 — Heartbeat lifecycle tests

- `2.8.0` starts heartbeat
- `2.4.0` and `2.1.1` do not
- timer is cleared on disconnect
- no duplicate timer on reconnect

#### 5.5 — Integration matrix

| Test | 2.1.1 | 2.4.0 | 2.8.0 |
|------|-------|-------|-------|
| Connect + exact version detect | yes | yes | yes |
| Unsupported version fail-closed | yes | yes | yes |
| Welcome/version/coalesced replay | yes | yes | yes |
| `allShipSettings` | yes | yes | yes |
| `playerUpdate` | yes | yes | yes |
| `npcUpdate` | yes | yes | yes |
| weapons flow | yes | yes | yes |
| GM buttons | no | yes | yes |
| `commsIncoming` filter layout | no | no | yes |
| `clientHeartbeat` lifecycle | no | no | yes |

#### 5.6 — Real-server validation

At least one validation pass against a real `2.4.0` server and a real `2.8.0` server is strongly recommended before calling the migration complete. Reverse-engineered protocol work should not rely on synthetic fixtures alone.

**Deliverable:** CI covers exact supported versions, boundary packet families, and connection edge cases that the original plan missed.

---

## File Impact Summary

### New Files

```
packages/protocol/src/version.ts
packages/protocol/src/capabilities.ts
packages/protocol/src/handshakeDecoder.ts
packages/protocol/src/packets/base/
packages/protocol/src/packets/families/
packages/protocol/src/packets/versions/v211.ts
packages/protocol/src/packets/versions/v240.ts
packages/protocol/src/packets/versions/v280.ts
packages/protocol/src/wireTables/

packages/shared/src/protocol.ts

test/fixtures/packets-v211/
test/fixtures/packets-v240/
test/fixtures/packets-v280/
test/fixtures/protocol-boundaries/
```

### Modified Files

```
packages/protocol/src/registry.ts            ← family metadata support
packages/protocol/src/frameDecoder.ts        ← use family metadata + safety guards
packages/protocol/src/index.ts               ← export versions, capabilities, manifests

packages/domain/src/events.ts                ← protocol-ready events and any distinct canonical variants
packages/domain/src/model.ts                 ← protocol block + tighter packet-derived types
packages/domain/src/mapPacket.ts             ← version-aware canonicalization
packages/domain/src/reducer.ts               ← protocol and later packet-family state

apps/server/src/artemis/client.ts            ← handshake-safe negotiation, full registry swap, heartbeat lifecycle
apps/server/src/index.ts                     ← pass protocol state through
apps/server/src/http/routes.ts               ← protocol/version endpoint if exposed

apps/web/src/                                ← capability-driven UI

test/fake-artemis/server.ts                  ← version-specific scripts and handshake-edge cases
```

### No Longer Assumed Unchanged

The previous plan claimed `PacketRegistry` and core protocol infrastructure could remain unchanged. That is no longer assumed. `BufferReader` and `BufferWriter` should still remain version-agnostic, but `PacketRegistry`, `FrameDecoder`, and client negotiation code all need additive work.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Coalesced TCP reads cause wrong-registry decode | Dedicated handshake decoder with leftover replay into a fresh full decoder |
| Unsupported versions silently decode incorrectly | Exact-version detection with fail-closed behavior |
| Enum drift across versions leaks raw numbers into domain code | Versioned wire-table manifests; no raw numeric IDs in domain logic |
| `ClientHeartbeatPacket` timer leaks across reconnects | Explicit lifecycle hooks and reconnect tests |
| Outgoing commands lag behind incoming profile switch | Replace both registry and decoder together; no decoder-only swap |
| Reverse-engineered spec gaps | Real capture fixtures plus real-server validation passes |
| Memory/DoS risk from malformed packet lengths | Max frame size guard in decoder |
| Frontend/server feature drift | Server-derived capabilities exposed over API/WebSocket |

---

## Recommended Implementation Order

1. **PR 1:** Phase 0 + Phase 1 together
   - exact version types
   - registry family metadata
   - handshake decoder
   - fail-closed detection
   - protocol/capability plumbing
   - handshake-edge tests
2. **PR 2:** Phase 2 exact `2.4.0` support
3. **PR 3:** Phase 3 exact `2.8.0` support
4. **PR 4:** Phase 4 frontend capability-driven UI
5. **PR 5:** Phase 5 fixture expansion and real-server validation cleanup

### Parallelization Guidance

- Phase 0 and Phase 1 belong in the same first PR because the handshake design depends on the protocol infra changes.
- Phase 2 should land before most of Phase 3 because `2.8.0` reuses earlier boundary modules and wire tables.
- Inside Phase 3, independent packet families can be split across branches or contributors once the shared manifests are established.

---

## Total Estimated Effort

| Phase | Days |
|-------|------|
| Phase 0: Protocol foundation and version audit | 3-4 |
| Phase 1: Handshake-safe version negotiation | 4-5 |
| Phase 2: Exact 2.4.0 support | 5-7 |
| Phase 3: Exact 2.8.0 support | 6-8 |
| Phase 4: Frontend protocol awareness | 2-3 |
| Phase 5: Testing and validation | 5-8 |
| **Total** | **25-35** |

---

## Summary

The main architectural choice still stands: choose protocol behavior at connection time and keep packet handling versioned below the domain layer. The revised plan makes that approach safe and realistic for the current codebase by:

- removing unsafe mid-buffer decoder hot-swaps
- removing unsafe nearest-version coercion
- expanding version coverage from one `objectTypes.ts` file into full wire-table manifests
- accounting for outgoing packet versioning and heartbeat lifecycle
- deriving capabilities on the server
- increasing the schedule to match the actual protocol surface area

That is the minimum revision needed to make the migration plan actionable rather than optimistic.
