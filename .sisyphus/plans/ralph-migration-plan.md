# Artemis Glitter — RALPH Migration Plan

Status: DRAFT v1
Source contract: docs/ralph-loop-implementation-planner-prompt.md
Inputs: docs/README.md, docs/current-architecture-and-review.md, docs/typescript-bun-react-migration-plan.md, repository sources at HEAD.

---

## 1. Planner Summary

- Strangler-style migration: keep legacy Node/Express/EJS/Socket.IO app fully working at every checkpoint; introduce Bun + TypeScript + React behind a `apps/`/`packages/` boundary; retire legacy paths only after parity is proven by tests.
- Phase 0 captures the safety net (packet fixtures + fake Artemis TCP server + DOM/screenshot baselines) BEFORE any byte-level rewrite, because protocol regressions are the highest-impact failure mode.
- Phase 1 stands up the Bun workspace skeleton (`apps/server`, `apps/web`, `packages/{protocol,domain,shared,config}`) with strict TS, lint, and CI scripts, but adds zero behavior.
- Phases 2–5 port pure code (BufferReader/Writer → packet registry → world-model reducer/selectors → vesselData loader). Each runs behind unit tests authored in P0; the legacy app is untouched.
- Phase 6 stands up the new Bun server (`Bun.serve` + WebSocket hub + typed Artemis client wrapper) and proves end-to-end parity against the fake Artemis TCP server. Single broadcast hub fixes the per-browser Socket.IO listener leak by construction.
- Phase 7 adds the React shell (TanStack Router file-based routes + TanStack Query + `useSyncExternalStore` realtime hook). No TanStack Start dependency.
- Phase 8 ports console UIs one route at a time (home → bearing-table → proximity → tubes → map). Legacy routes remain available until each replacement passes smoke tests.
- Phase 9 deletes the legacy stack (Express 3, EJS, Socket.IO 1.x, Grunt) and finalizes README/scripts.
- Phase 10 evaluates `bun build --compile` for distribution; intentionally deferred.
- Three known production bugs are scheduled with explicit regression tests: (a) `vesselData.js:90` undefined `dir`; (b) `app.js:99` Socket.IO per-connection listener leak; (c) command endpoints moved from `GET` to validated `POST /api/...`.

## 2. Assumptions

- A1. Bun ≥ 1.1 is acceptable as the new runtime; we will pin a specific minor version in `package.json#engines` and CI.
- A2. The team is willing to use TanStack Router with file-based routing and TanStack Query. We will NOT use TanStack Start (still RC per migration plan).
- A3. The new realtime layer is native WebSocket via `Bun.serve`'s websocket support; we do NOT need to preserve Socket.IO wire compatibility because no third-party clients consume this server.
- A4. Existing tests are absent (`package.json` has no `scripts`); we are free to introduce `bun:test` as the primary test runner for new packages, plus `tsc -b --noEmit` for typechecking.
- A5. The Artemis protocol target is the same version the legacy code already supported (Artemis 2.1.1 per repo README). Any newer Artemis version compatibility is out of scope.
- A6. `node-webkit` packaging is deprecated and will be replaced by `bun build --compile` (Phase 10). We will NOT maintain a node-webkit compatibility branch.
- A7. The legacy `node-xml-lite` parser will be replaced; a small, maintained alternative such as `fast-xml-parser` (or hand-written parser sufficient for `vesselData.xml`) will be selected during P5 with a recorded ADR. Either choice is acceptable as long as fixture parity holds.
- A8. The `dat/` directory (Artemis-shipped vessel data and `.snt` files) is provided externally by the user via config or CLI; we ship empty/example fixtures for tests only.
- A9. We use Node-compatible `node:net` under Bun for the Artemis TCP client during the migration (per migration plan §"Artemis TCP Client" option 1). Switch to `Bun.connect` only after protocol-level parity holds.
- A10. The "broadcast hub" listens once at server startup and fan-outs to a managed set of WebSocket clients. We will NOT mount per-connection listeners on the Artemis client.
- A11. Visual parity is judged by side-by-side screenshot review at three breakpoints (desktop landscape, tablet landscape, phone portrait). Pixel-exact identity is not required.
- A12. Worker agents only edit files inside their declared Write Scope. The orchestrator is responsible for sequencing concurrent agents so no two agents share a write path at the same time.

## 3. Target Architecture

### 3.1 Workspace Layout

```text
.
├─ apps/
│  ├─ server/          # Bun runtime: HTTP API, WebSocket hub, Artemis client wrapper
│  └─ web/             # React + TanStack Router/Query SPA
├─ packages/
│  ├─ protocol/        # BufferReader/Writer, packet registry, packet defs, codec tests
│  ├─ domain/          # World-model types, reducer, selectors, vesselData loader, angles/prettyprint
│  ├─ shared/          # API DTOs, realtime event/command schemas, validators
│  └─ config/          # Typed config + CLI/env/file merge
├─ test/
│  └─ fake-artemis/    # Fake Artemis TCP server used by integration/E2E
├─ docs/               # Existing docs + migration ADRs (additive only)
├─ public/             # Legacy static assets DURING migration; deleted in P9
├─ views/, routes/, public/javascripts/, app.js, artemisNet.js, artemisBufferReader.js, vesselData.js, packets/   # LEGACY — frozen until P9
├─ package.json        # Bun workspace root
├─ bun.lock
├─ bunfig.toml
├─ tsconfig.base.json
└─ eslint.config.js
```

### 3.2 Package Boundaries (dependency direction →)

```text
apps/web ─────────────► packages/shared ◄─────── apps/server
        └──► packages/domain ◄────────────────────┘
                      ▲
                      │
              packages/protocol  ◄─── apps/server
                      ▲
                      │
              packages/config ◄──── apps/server, apps/web (build-time only)
```

Rules:
- `packages/protocol` MAY NOT import from `domain`, `shared`, `server`, `web`, or browser globals.
- `packages/domain` MAY import from `protocol` only for shared types; MAY NOT import from `server`, `web`, Bun APIs, Node `net`, or DOM.
- `packages/shared` is leaf-level — pure schemas + zod (or valibot) validators.
- `apps/server` owns Bun runtime concerns: `Bun.serve`, websockets, `node:net` Artemis socket, logging, station selection.
- `apps/web` owns React + Router + Query; consumes `shared` for DTOs and `domain` for selectors.

### 3.3 Process & Transport Topology

```text
[ Artemis SBS server :2010 ]
            ▲
            │  TCP (Artemis protocol, single socket)
            │
[ apps/server (Bun) ]
   ├─ HTTP API   (POST /api/connect, /api/disconnect, /api/ship-select, /api/tubes/:tube/{load,unload,fire},
   │              GET  /api/status, /api/model, /api/glitter-addresses)
   ├─ WebSocket  (/api/realtime — single broadcast hub; fan-out to N browsers)
   └─ Static     (apps/web build artifacts)
            ▲
            │
[ apps/web (React SPA) ]
   ├─ TanStack Router (/, /bearing-table, /proximity, /tubes, /map)
   ├─ TanStack Query  (initial /api/model snapshot, status, command mutations)
   └─ useSyncExternalStore over WebSocket → reducer (from packages/domain)
```

### 3.4 Behavior Preservation Contract

The following behaviors MUST hold at every Phase 6+ exit checkpoint:

1. Glitter HTTP server starts on `config.tcpPort` (default `3000`).
2. Connect/disconnect to Artemis TCP `:2010`.
3. Player ship selection.
4. Welcome handler triggers station selection sequence: shipSelect → setStation(0,1) → setStation(7,1) → setStation(9,1) → ready.
5. All parsed Artemis packets relayed to browser clients in real time.
6. Initial world-model hydration on browser load.
7. Maintained model surfaces: entities, comms, intel, incoming audio, ship settings, engineering, weapons, damcon, skybox, difficulty, started/paused, server version, vessel/faction data.
8. Connection/game-over overlay across all consoles.
9. Bearing-distance table screen behavior.
10. Proximity monitor with shield/nebula/hazard/hostile/mine/drone status + audio alerts.
11. Tube matrix with stores + status grid; load/unload/fire commands.
12. Debug map screen (entity dots/labels/selection — OpenLayers replacement allowed).
13. Glitter address broadcast into Artemis GM/comms once simulation starts.
14. CLI flags: `--headless`, `--server <addr>`, plus new `--port <port>` and `--dat-dir <path>`.

## 4. Phase Plan

### Phase 0 — Baseline & Safety Net
- Goal: make current behavior observable and capture fixtures BEFORE any byte-level rewrite.
- Tasks: P0-T1 (route+packet inventory doc), P0-T2 (packet fixture corpus), P0-T3 (fake Artemis TCP server), P0-T4 (DOM/screenshot baselines for legacy consoles).
- Dependencies: none (parallel with P1).
- Exit Criteria:
  - Inventory committed at `docs/route-and-packet-inventory.md`.
  - At least 12 packet fixture binaries under `test/fixtures/packets/` covering: complete single, split-across-chunks, multi-packet-in-one-chunk, unknown-type, unknown-subtype, plus 1 outgoing per command (load, unload, fire, ship-select, ready, setStation, gameMasterMessage).
  - `test/fake-artemis/` runs via `bun run test:fake-artemis` and emits welcome → version → allShipSettings → playerUpdate → weaponsUpdate → gameOverReason in a scripted timeline.
  - Screenshot baselines for `/`, `/bearing-table`, `/proximity`, `/tubes`, `/map` saved under `test/baselines/`.

### Phase 1 — Bun Workspace Skeleton
- Goal: introduce Bun + TypeScript + lint/CI scaffolding without touching legacy behavior.
- Tasks: P1-T1 (root workspace + bun.lock), P1-T2 (tsconfig.base + per-package tsconfig), P1-T3 (eslint flat config + prettier), P1-T4 (CI script wiring), P1-T5 (empty package skeletons + index.ts smoke exports).
- Dependencies: none (parallel with P0). All P1 tasks require P1-T1 first.
- Exit Criteria:
  - `bun install --frozen-lockfile` succeeds from a clean checkout.
  - `bun run typecheck`, `bun test`, `bun run lint` all pass on empty packages.
  - Legacy `app.js` + `node` execution path is NOT removed and still parses (`node --check` still clean).
  - `tsc -b --noEmit` runs as a separate step from any Bun transpile/run path.

### Phase 2 — Binary Reader/Writer
- Goal: move byte-level primitives from `artemisBufferReader.js` into typed code.
- Tasks: P2-T1 (BufferReader.ts + tests), P2-T2 (BufferWriter.ts + tests), P2-T3 (typed PacketCodecError result types).
- Dependencies: P0-T2 (fixtures), P1-T5 (skeleton).
- Exit Criteria:
  - Every method used by the legacy `artemisBufferReader.js` is reproduced with explicit pointer accounting.
  - Fixtures from P0-T2 round-trip read/write byte-identical to legacy reader output for the same inputs.
  - 100% branch coverage on bounds errors, endianness, string terminators, bit ordering.

### Phase 3 — Packet Registry & Definitions
- Goal: port the 50 packet defs into typed modules with a static registry.
- Tasks: P3-T1 (packet types + registry shape), P3-T2 (port outgoing client actions), P3-T3 (port core incoming packets), P3-T4 (port remaining packets), P3-T5 (typed `PacketDecoder` result enum + multi-subpacket framing tests).
- Dependencies: P2 complete.
- Exit Criteria:
  - All 50 packet defs ported (1:1 by name with legacy `packets/**`).
  - Decode of every fixture in P0-T2 yields legacy-equivalent payloads (snapshot test).
  - Encode of every command fixture yields legacy-equivalent bytes.
  - Multi-subpacket frames decode all subpackets and report the unread tail length as 0 on success.
  - Unknown subtype is reported as a typed `unknown` variant; pointer is advanced based on declared `packetLength`, never reuses prior `packetDef`.

### Phase 4 — Domain Model (Reducer + Selectors)
- Goal: extract `worldmodel.js` into a pure framework-independent package.
- Tasks: P4-T1 (WorldModel types + initial state), P4-T2 (packet→domain event mapping), P4-T3 (reducer), P4-T4 (selectors: own ship, nearest vessels, bearing rows, proximity status, tube matrix, connection overlay, debug map entities), P4-T5 (port `angles.js` + `prettyprint.js` to typed pure functions).
- Dependencies: P3 complete.
- Exit Criteria:
  - Reducer reproduces world-model state across captured packet sequences.
  - Selectors produce numerically identical outputs to legacy DOM derivations on fixture models (within float tolerance documented in tests).
  - No import from `node:net`, Bun APIs, DOM, React, or `apps/server`.

### Phase 5 — Vessel Data Loader
- Goal: replace `vesselData.js` and FIX the `dir` undefined bug behind a regression test.
- Tasks: P5-T1 (XML parser selection ADR + dependency), P5-T2 (`findDatDir` + `loadVesselData` typed API), P5-T3 (`.snt` grid parser + tests), P5-T4 (regression test reproducing legacy `dir` bug then asserting fix).
- Dependencies: P4 (uses domain types).
- Exit Criteria:
  - Missing `dat/` degrades to empty `vessels`/`factions` (matches legacy non-fatal behavior).
  - `.snt` grid parser produces grids matching a recorded fixture.
  - Regression test FAILS on legacy `vesselData.js` and PASSES on `packages/domain/src/vesselData.ts`.

### Phase 6 — Bun Server MVP
- Goal: stand up `apps/server` with typed API + single broadcast hub + Artemis client wrapper.
- Tasks: P6-T1 (typed config + CLI), P6-T2 (Artemis client wrapper using `node:net` + state machine), P6-T3 (Bun HTTP API routes — POST commands), P6-T4 (zod request validation + `ApiResult<T>`), P6-T5 (single broadcast hub WebSocket + topic publish), P6-T6 (station-selection sequence on `welcome`), P6-T7 (Glitter address discovery + GM message broadcast), P6-T8 (structured logger).
- Dependencies: P3, P4, P5; P0-T3 (fake Artemis TCP) for integration verification.
- Exit Criteria:
  - Server starts via `bun run dev` and connects to fake Artemis TCP server.
  - All POST command endpoints respond with `ApiResult<T>` and reject malformed bodies.
  - Single Artemis listener at startup; per-browser WebSocket connections do NOT register additional listeners on the Artemis client.
  - `GET /api/model` returns a typed `WorldModelSnapshot`.
  - End-to-end: connect → ship-select → fire-tube → fake Artemis observes the encoded fire-tube bytes; UI receives a weaponsUpdate event.

### Phase 7 — React Shell & Routing
- Goal: stand up `apps/web` with TanStack Router file-based routing + TanStack Query + realtime WebSocket hook.
- Tasks: P7-T1 (Vite/Bun build config for web), P7-T2 (TanStack Router file routes + root layout), P7-T3 (`QueryClient` + API client + queries/mutations), P7-T4 (`useRealtimeModel` hook with `useSyncExternalStore`), P7-T5 (ConnectionOverlay component using `selectConnectionOverlay`), P7-T6 (CSS/asset bundling baseline).
- Dependencies: P6 (needs `/api/model` + `/api/realtime`).
- Exit Criteria:
  - `bun --filter @artemis-glitter/web dev` serves the SPA against the running Bun server.
  - Initial model fetch + WebSocket reconnection works.
  - Connection overlay reflects all connection states from fake Artemis.

### Phase 8 — Port Consoles (one per task)
- Goal: replace legacy EJS+global-script consoles with React routes.
- Tasks: P8-T1 (Home), P8-T2 (Bearing table), P8-T3 (Proximity), P8-T4 (Tubes), P8-T5 (Debug map).
- Dependencies: P7. Each task is independent of the others (disjoint write scopes inside `apps/web/src/routes/` and `apps/web/src/components/`).
- Exit Criteria per route:
  - Visual parity vs P0 baseline at three breakpoints.
  - Component tests pass.
  - Fake-Artemis E2E smoke test for that route passes.
  - Legacy `views/<route>.ejs` and `public/javascripts/<route>.js` are NOT YET deleted (deletion gated to P9).

### Phase 9 — Remove Legacy Stack
- Goal: delete Express 3, EJS, Socket.IO, Grunt, node-webkit, and legacy public scripts.
- Tasks: P9-T1 (delete legacy server entrypoints + routes + views), P9-T2 (delete legacy public scripts kept only by EJS), P9-T3 (delete `Gruntfile.js`, `server-page.html`, node-webkit fields in `package.json`), P9-T4 (update README to Bun commands), P9-T5 (final lint/typecheck/test sweep).
- Dependencies: ALL P8 sub-tasks at green.
- Exit Criteria:
  - No file under `views/`, `routes/`, or `public/javascripts/` remains.
  - `app.js`, `artemisNet.js`, `artemisBufferReader.js`, `vesselData.js`, `Gruntfile.js`, `server-page.html` deleted.
  - `package.json` is the Bun workspace root only; legacy dependency entries removed.
  - `bun run dev`, `bun run build`, `bun test`, `bun run typecheck`, `bun run lint` all green.

### Phase 10 — Distribution
- Goal: evaluate `bun build --compile` for single-file executables.
- Tasks: P10-T1 (production web build embedded into server), P10-T2 (`bun build --compile` per platform target), P10-T3 (release artifact docs + license/attribution).
- Dependencies: P9 complete.
- Exit Criteria:
  - At least one platform (host platform of the implementer) produces a runnable single-file executable that hosts the Bun server and serves the web UI.
  - External `dat/` is configurable at runtime without rebuild.

## 5. Agent Task Cards

Cards are atomic. Each card is for ONE worker agent, ONE focused session, with a disjoint write scope. IDs are stable.

---

### P0-T1 — Route & Packet Inventory

- ID: P0-T1
- Owner: docs-engineer
- Status: planned
- Dependencies: none
- Write Scope:
  - `docs/route-and-packet-inventory.md` (NEW)
- Read Context:
  - `app.js`
  - `routes/index.js`
  - `artemisNet.js`
  - `packets/**`
  - `views/**`
  - `public/javascripts/**`
  - `docs/current-architecture-and-review.md`
- Instructions:
  1. Walk `app.js` + `routes/index.js` and list every HTTP route with method, path, current handler behavior, and target POST replacement (per migration plan §"API Contract Sketch").
  2. Walk `packets/**` and list every packet file with: file path, `name`, `type`, `subtype`, direction (incoming vs outgoing), and one-sentence purpose.
  3. List every `artemisNet.on(...)` and `io.sockets.on(...)` listener with the file:line where it is attached.
  4. Produce three tables: HTTP routes, packets, listeners.
  5. End with a "Behavior Preservation Checklist" mirroring the 14-item list in §3.4 of the migration plan, with a column for "covered by which fixture" (left blank — filled by P0-T2).
- Acceptance Criteria:
  - Document committed at the Write Scope path.
  - All 50 packet files referenced.
  - All current routes from `app.js` referenced (including `/connect/:server`, `/disconnect`, `/ship-select/:playerShipIndex`, `/unload-tube/:tube`, `/fire-tube/:tube`, `/load-tube/:tube/:ordnance`).
- Verification:
  - `wc -l docs/route-and-packet-inventory.md` ≥ 80.
  - `grep -c '^| ' docs/route-and-packet-inventory.md` shows table rows present.
- Deliverables: `docs/route-and-packet-inventory.md`.

---

### P0-T2 — Packet Fixture Corpus

- ID: P0-T2
- Owner: test-engineer
- Status: planned
- Dependencies: P0-T1 (inventory anchors fixture coverage)
- Write Scope:
  - `test/fixtures/packets/` (NEW)
  - `test/fixtures/README.md` (NEW)
  - `test/tools/capture-fixture.ts` (NEW) — small Node-compatible helper script
- Read Context:
  - `artemisNet.js`
  - `artemisBufferReader.js`
  - `packets/**`
  - `docs/route-and-packet-inventory.md` (from P0-T1)
- Instructions:
  1. Author a small Node-compatible script that, given a list of packet names + payload objects, uses the LEGACY `artemisNet.emit` codepath (refactored to a pure encode helper if needed — keep refactor isolated and reverted if it touches more than the new helper file) to emit byte buffers and writes them to `test/fixtures/packets/<name>.bin`.
  2. Capture or hand-author binary fixtures for at least the following inputs:
     - `welcome.bin`
     - `version.bin`
     - `allShipSettings.bin`
     - `playerUpdate.bin`
     - `npcUpdate.bin`
     - `weaponsUpdate.bin`
     - `engineeringUpdate.bin`
     - `destroyObject.bin`
     - `gameOverReason.bin`
     - `gameOverStats.bin`
     - `multi-subpacket.bin` (one frame containing two object updates)
     - `split-across-chunks.bin` (intentionally cut at byte 30 of 96)
     - `unknown-type.bin` (header.type = 0xDEADC0DE)
     - `unknown-subtype.bin` (valid type, unknown subtype)
     - Outgoing commands (paired by name): `out-shipSelect.bin`, `out-setStation.bin`, `out-ready.bin`, `out-loadTube.bin`, `out-unloadTube.bin`, `out-fireTube.bin`, `out-gameMasterMessage.bin`.
  3. For each fixture, also write `<name>.json` with the canonical decoded payload (used as snapshot in P3 tests).
  4. Add `test/fixtures/README.md` describing how to regenerate.
- Acceptance Criteria:
  - All listed `.bin` files exist with non-zero size.
  - All listed `.json` files exist with valid JSON.
  - The capture helper script runs under Node 20 with no external network calls.
- Verification:
  - `ls test/fixtures/packets/*.bin | wc -l` ≥ 16
  - `bun run test/tools/capture-fixture.ts --dry-run` exits 0 (when run from repo root after P1-T1 completes; for P0 alone, run with `node test/tools/capture-fixture.ts --dry-run`)
- Deliverables: fixture binaries + JSON shadows + helper script.

---

### P0-T3 — Fake Artemis TCP Server

- ID: P0-T3
- Owner: test-engineer
- Status: planned
- Dependencies: P0-T2
- Write Scope:
  - `test/fake-artemis/` (NEW)
- Read Context:
  - `artemisNet.js`
  - `packets/**`
  - `test/fixtures/packets/**` (from P0-T2)
- Instructions:
  1. Build a Node-compatible (and later Bun-compatible) TCP server that listens on a configurable port (default `12010`).
  2. On client connect, follow a scripted timeline that emits these fixtures in order, with configurable inter-packet delays:
     - `welcome.bin` (immediate)
     - `version.bin` (+50ms)
     - `allShipSettings.bin` (+50ms)
     - `playerUpdate.bin` (+200ms, then loop every 200ms with monotonic ID)
     - `weaponsUpdate.bin` (+1000ms once)
     - `gameOverReason.bin` (only after receiving an outgoing `fireTube` from client)
  3. Record every received TCP byte chunk into an in-memory log accessible via a `getReceived(): Buffer[]` API for tests.
  4. Provide a small CLI: `bun run test/fake-artemis/cli.ts --port 12010 --script default`.
  5. Provide a programmatic API: `createFakeArtemis(opts) → { listen, close, getReceived, sendFixture }`.
- Acceptance Criteria:
  - Real legacy `artemisNet.connect('localhost', 0)` against this server can decode `welcome` + `playerUpdate` without errors (when pointed at port `12010`).
  - Outgoing `loadTube` / `fireTube` from the legacy client appear in `getReceived()` as the exact expected fixture bytes.
- Verification:
  - `bun test test/fake-artemis/` (added in P1) green.
  - Manual: `node app.js --headless --server localhost` (with port hack) connects without `Bad magic number` errors.
- Deliverables: `test/fake-artemis/server.ts`, `test/fake-artemis/cli.ts`, `test/fake-artemis/scripts/default.ts`.

---

### P0-T4 — DOM/Screenshot Baselines

- ID: P0-T4
- Owner: test-engineer
- Status: planned
- Dependencies: none (parallel with P0-T1/T2/T3)
- Write Scope:
  - `test/baselines/` (NEW)
  - `test/baselines/README.md` (NEW)
- Read Context:
  - `views/**`
  - `public/javascripts/**`
  - `public/stylesheets/**`
- Instructions:
  1. Bring up the legacy app (with whatever local install is feasible — if dependencies cannot be installed, document the blocker and produce annotated DOM-snapshot markdown describing each route's structure as a fallback).
  2. For each console (`/`, `/bearing-table`, `/proximity`, `/tubes`, `/map`), capture either:
     - a real screenshot at desktop landscape (1920×1080), tablet landscape (1024×768), and phone portrait (414×896) saved as `<route>-<breakpoint>.png`, OR
     - a hand-authored DOM-shape spec at `test/baselines/<route>.dom.md` describing required elements and their visible roles.
  3. Note all click/keyboard interactions per page in `test/baselines/<route>.interactions.md`.
- Acceptance Criteria:
  - Either screenshots OR DOM-shape specs exist for all 5 routes.
  - Interaction docs exist for the 4 active consoles (home, bearing, proximity, tubes; map is read-only).
- Verification:
  - `ls test/baselines/` lists ≥ 5 baseline files.
- Deliverables: baseline images and/or DOM specs + interaction docs.

---

### P1-T1 — Bun Workspace Root + Lockfile

- ID: P1-T1
- Owner: tooling-engineer
- Status: planned
- Dependencies: none (must precede all other P1 tasks)
- Write Scope:
  - `package.json` (REPLACED — preserve legacy script as `legacy:start` only if needed for parity testing; do not delete legacy source files)
  - `bun.lock` (NEW)
  - `bunfig.toml` (NEW)
- Read Context:
  - `package.json` (legacy)
  - `docs/typescript-bun-react-migration-plan.md` §"Root tooling"
- Instructions:
  1. Convert `package.json` to a Bun workspace root with `"workspaces": ["apps/*", "packages/*"]`, `"private": true`, `"type": "module"`.
  2. Add scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `legacy:start` (= `node app.js`).
  3. DO NOT delete legacy `dependencies`/`devDependencies`. Move them under a single object `"legacyDependencies"` with a comment in a sibling `LEGACY-DEPENDENCIES.md` explaining they are reference-only and will be removed in P9.
  4. Run `bun install` to generate `bun.lock`.
  5. `bunfig.toml` sets `[install] frozenLockfile = true` for CI.
- Acceptance Criteria:
  - `bun install --frozen-lockfile` exits 0 on a clean `node_modules`-less checkout.
  - `node --check app.js` still passes (legacy still runnable in principle).
- Verification:
  - `bun --version` works.
  - `bun pm ls` lists workspace packages (empty list acceptable until P1-T5).
- Deliverables: updated `package.json`, `bun.lock`, `bunfig.toml`, `LEGACY-DEPENDENCIES.md`.

---

### P1-T2 — TypeScript Configuration

- ID: P1-T2
- Owner: tooling-engineer
- Status: planned
- Dependencies: P1-T1
- Write Scope:
  - `tsconfig.base.json` (NEW)
  - `tsconfig.json` (NEW; references-only root)
- Read Context:
  - migration plan §"TypeScript configuration"
- Instructions:
  1. Author `tsconfig.base.json` with: `target: ESNext`, `module: Preserve`, `moduleResolution: bundler`, `jsx: react-jsx`, `verbatimModuleSyntax: true`, `strict: true`, `noUncheckedIndexedAccess: true`, `noFallthroughCasesInSwitch: true`, `noImplicitOverride: true`, `noEmit: true`, `skipLibCheck: true`.
  2. Author root `tsconfig.json` as a project-references file pointing to `apps/server`, `apps/web`, `packages/protocol`, `packages/domain`, `packages/shared`, `packages/config` (paths point to per-package configs added in P1-T5).
  3. Add `"types": ["bun"]` ONLY to Bun-targeted packages (server, protocol-test runner, etc.), NEVER to `apps/web`.
  4. Add a top-level npm script `"typecheck": "tsc -b --noEmit"`.
- Acceptance Criteria:
  - `bun run typecheck` invokes `tsc -b --noEmit` (NOT a Bun-internal type pass).
  - `tsc --version` ≥ 5.4 used.
- Verification:
  - `bun run typecheck` exits 0 once empty packages exist (P1-T5).
- Deliverables: tsconfig files.

---

### P1-T3 — ESLint + Prettier Flat Config

- ID: P1-T3
- Owner: tooling-engineer
- Status: planned
- Dependencies: P1-T1
- Write Scope:
  - `eslint.config.js` (NEW)
  - `.prettierrc.json` (NEW)
  - `.editorconfig` (NEW)
- Read Context:
  - migration plan §"Linting and formatting"
- Instructions:
  1. ESLint flat config with `@typescript-eslint`, `eslint-plugin-react-hooks`, and TanStack Query plugin loaded conditionally for `apps/web` files.
  2. Rules per migration plan: warn on `any` migration-wide (escalate to error in P9), no-floating-promises ERROR for server/domain, no-direct-DOM-mutation ERROR in apps/web, no-`innerHTML` ERROR (allow opt-out via comment).
  3. Prettier as the sole formatter; integrate with ESLint via `eslint-config-prettier`.
- Acceptance Criteria:
  - `bun run lint` and `bun run format` work and report no errors on empty packages.
- Verification:
  - `bun run lint -- --max-warnings=999` succeeds.
- Deliverables: lint + format configs.

---

### P1-T4 — CI Scripts

- ID: P1-T4
- Owner: tooling-engineer
- Status: planned
- Dependencies: P1-T1, P1-T2, P1-T3
- Write Scope:
  - `.github/workflows/ci.yml` (NEW; ok if there's no GitHub remote — file is for future use)
  - `scripts/ci/run-all.sh` (NEW)
- Read Context:
  - migration plan §"Phase 1 — Create Bun workspace skeleton"
- Instructions:
  1. CI pipeline: `bun install --frozen-lockfile` → `bun run typecheck` → `bun test` → `bun run lint` → `bun run format -- --check`.
  2. Cache `~/.bun/install/cache` keyed by `bun.lock`.
  3. `scripts/ci/run-all.sh` invokes the same four steps locally for parity.
- Acceptance Criteria:
  - `bash scripts/ci/run-all.sh` exits 0 on a clean checkout.
- Verification:
  - Run script locally; observe exit code 0.
- Deliverables: CI workflow + local runner.

---

### P1-T5 — Empty Package Skeletons

- ID: P1-T5
- Owner: tooling-engineer
- Status: planned
- Dependencies: P1-T1, P1-T2
- Write Scope:
  - `apps/server/` (NEW: package.json, tsconfig.json, src/index.ts placeholder)
  - `apps/web/` (NEW: package.json, tsconfig.json, src/main.tsx placeholder, index.html stub)
  - `packages/protocol/` (NEW: package.json, tsconfig.json, src/index.ts)
  - `packages/domain/` (NEW: package.json, tsconfig.json, src/index.ts)
  - `packages/shared/` (NEW: package.json, tsconfig.json, src/index.ts)
  - `packages/config/` (NEW: package.json, tsconfig.json, src/index.ts)
- Read Context:
  - migration plan §"Proposed repository layout"
- Instructions:
  1. Each `package.json` uses `"name": "@artemis-glitter/<pkg>"`, `"type": "module"`, `"private": true`, and `"exports"` map for `./*` paths.
  2. Each placeholder `index.ts` exports a single string (e.g., `export const PACKAGE_NAME = '@artemis-glitter/protocol';`).
  3. Per-package `tsconfig.json` extends `tsconfig.base.json` and lists `composite: true` + `outDir`.
- Acceptance Criteria:
  - `bun run typecheck` exits 0.
  - `bun test` exits 0 (no tests yet).
- Verification:
  - All six packages appear in `bun pm ls`.
- Deliverables: six package skeletons.

---

### P2-T1 — BufferReader

- ID: P2-T1
- Owner: protocol-engineer
- Status: planned
- Dependencies: P0-T2, P1-T5
- Write Scope:
  - `packages/protocol/src/BufferReader.ts` (NEW)
  - `packages/protocol/src/BufferReader.test.ts` (NEW)
- Read Context:
  - `artemisBufferReader.js`
  - `test/fixtures/packets/**`
- Instructions:
  1. Implement a class `BufferReader(buffer: ArrayBufferView | Uint8Array)` with internal `pointer: number`.
  2. Methods (all advance `pointer` and bounds-check, throwing `BufferReaderRangeError` typed error):
     `readByte(): number`,
     `readUInt8(): number` (alias),
     `readUInt16LE(): number`,
     `readUInt32LE(): number` (legacy `readLong`),
     `readInt32LE(): number`,
     `readFloatLE(): number`,
     `readUtf16String(): string`,
     `readAsciiString(): string`,
     `readBitArray(byteLen: number): boolean[]`.
  3. Provide a `peek(offset)` and `seek(absolute)` that does NOT advance the pointer except via `seek`.
  4. Tests: every method, each fixture's known prefix bytes, EOF behavior, malformed lengths, multi-byte boundary reads.
- Acceptance Criteria:
  - For each fixture in `test/fixtures/packets/*.bin`, the first 24 bytes parse to a `header` object byte-identical to legacy.
  - 100% line + branch coverage on `BufferReader.ts`.
- Verification:
  - `bun test packages/protocol/src/BufferReader.test.ts` green.
- Deliverables: reader + tests.

---

### P2-T2 — BufferWriter

- ID: P2-T2
- Owner: protocol-engineer
- Status: planned
- Dependencies: P0-T2, P1-T5
- Write Scope:
  - `packages/protocol/src/BufferWriter.ts` (NEW)
  - `packages/protocol/src/BufferWriter.test.ts` (NEW)
- Read Context:
  - `artemisBufferReader.js` (writer methods on the same class)
  - `artemisNet.js` §`emit()` for header layout
  - `test/fixtures/packets/out-*.bin`
- Instructions:
  1. Implement `BufferWriter(initialSize?: number)` over `Buffer.alloc(initialSize ?? 2048)` (use `Buffer.alloc`, NEVER `new Buffer(...)`).
  2. Methods: `writeByte`, `writeUInt8`, `writeUInt16LE`, `writeUInt32LE` (legacy `writeLong`), `writeInt32LE`, `writeFloatLE`, `writeUtf16String`, `writeAsciiString`, `writeBitArray`, plus `patchUInt32LE(offset, value)` for header backpatching.
  3. Auto-grow strategy: doubling, capped at 1 MiB; throw typed error on overflow.
  4. `toBuffer(): Buffer` returns a slice of the written prefix.
  5. Tests: each method round-trips against `BufferReader`; every `out-*.bin` fixture is reproduced byte-identical when given the corresponding canonical payload from `out-*.json`.
- Acceptance Criteria:
  - All `out-*.bin` fixtures reproduced byte-identical.
  - No use of `new Buffer(...)`.
- Verification:
  - `bun test packages/protocol/src/BufferWriter.test.ts` green.
- Deliverables: writer + tests.

---

### P2-T3 — Codec Result Types

- ID: P2-T3
- Owner: protocol-engineer
- Status: planned
- Dependencies: P2-T1, P2-T2
- Write Scope:
  - `packages/protocol/src/types.ts` (NEW)
  - `packages/protocol/src/types.test.ts` (NEW)
- Read Context:
  - migration plan §"Phase 3" packet interface sketch
  - `docs/current-architecture-and-review.md` §"P1: Binary Parser Can Stall Or Misparse On Unknown Subpackets"
- Instructions:
  1. Define exported types:
     `type DecodeResult<T> = { kind: "ok"; value: T; bytesConsumed: number } | { kind: "incomplete"; need: number } | { kind: "unknown"; type: number; subtype: number | null; bytesConsumed: number } | { kind: "malformed"; reason: string; bytesConsumed: number };`
     `type EncodeResult = { kind: "ok"; buffer: Buffer } | { kind: "error"; reason: string };`
     `type PacketName = string & { readonly __brand: "PacketName" };`
     `type PacketDefinition<TName extends string, TPayload> = { ... };`
  2. Tests: type-level assertions using `expectTypeOf` from `expect-type` package, plus a runtime exhaustiveness test that ensures all `kind` variants are handled by a sample switch.
- Acceptance Criteria:
  - All four `DecodeResult` variants exercised by tests.
  - Type tests pass under `tsc -b --noEmit`.
- Verification:
  - `bun test packages/protocol/src/types.test.ts` + `bun run typecheck`.
- Deliverables: types + tests.

---

### P3-T1 — Packet Registry Shape

- ID: P3-T1
- Owner: protocol-engineer
- Status: planned
- Dependencies: P2 complete
- Write Scope:
  - `packages/protocol/src/registry.ts` (NEW)
  - `packages/protocol/src/registry.test.ts` (NEW)
- Read Context:
  - `artemisNet.js` §`registerPacketType`, `recursiveRegisterPacket`
  - `packages/protocol/src/types.ts`
- Instructions:
  1. Implement a STATIC registry: `class PacketRegistry { register(def): void; getByType(type, subtype?): PacketDefinition | undefined; getByName(name): PacketDefinition | undefined; all(): PacketDefinition[] }`.
  2. NEVER use `fs.readdirSync` / dynamic `require`. All packet defs are imported by static `import` statements (lifted to `packages/protocol/src/packets/index.ts` in later tasks).
  3. Subtype handling: if `subtype === null`, key by `type`; else key by `(type, subtype)`. Same semantics as legacy `knownPackets` / `knownSubPackets`.
  4. Tests: register/get round-trips, conflict rejection on duplicate `(type, subtype)`.
- Acceptance Criteria:
  - Registry passes round-trip tests.
  - No filesystem calls in production code.
- Verification:
  - `bun test packages/protocol/src/registry.test.ts`.
- Deliverables: registry + tests.

---

### P3-T2 — Outgoing Client Action Packets

- ID: P3-T2
- Owner: protocol-engineer
- Status: planned
- Dependencies: P3-T1
- Write Scope:
  - `packages/protocol/src/packets/outgoing/` (NEW directory; one file per packet)
  - `packages/protocol/src/packets/outgoing/index.ts` (NEW; barrel export)
  - `packages/protocol/src/packets/outgoing/*.test.ts` (NEW; one test per packet)
- Read Context:
  - `packets/clientActions1/`
  - `packets/clientActions2/`
  - `packets/heartbeat.js`
  - `packets/gameMasterMessage.js`
  - `test/fixtures/packets/out-*.bin` + `.json`
- Instructions:
  1. Port: `ready`, `shipSelect`, `setStation`, `loadTube`, `unloadTube`, `fireTube`, `gameMasterMessage`, plus `heartbeat` if outgoing in legacy.
  2. Each packet exports a typed `PacketDefinition` with `encode(writer, payload)`.
  3. For each packet, a snapshot test asserts that encoding `<name>.json` produces bytes equal to `out-<name>.bin`.
- Acceptance Criteria:
  - All listed outgoing packets ported.
  - All snapshot tests pass.
- Verification:
  - `bun test packages/protocol/src/packets/outgoing/`.
- Deliverables: packet modules + tests.

---

### P3-T3 — Core Incoming Packets

- ID: P3-T3
- Owner: protocol-engineer
- Status: planned
- Dependencies: P3-T1
- Write Scope:
  - `packages/protocol/src/packets/incoming/core/` (NEW directory)
  - `packages/protocol/src/packets/incoming/core/index.ts` (NEW)
  - `packages/protocol/src/packets/incoming/core/*.test.ts` (NEW)
- Read Context:
  - `packets/welcome.js`, `packets/version.js`, `packets/consoleStatus.js`
  - `packets/objectUpdate/` (allShipSettings, playerUpdate, npcUpdate, stationUpdate, weaponsUpdate, engineeringUpdate)
  - `packets/destroyObject.js`
  - `packets/gameMessage/gameOverReason.js`, `packets/gameMessage/gameOverStats.js`
  - corresponding fixtures in `test/fixtures/packets/`
- Instructions:
  1. Port the 12 core incoming packets named in Phase 3 of the migration plan.
  2. For each packet, snapshot-decode against the matching fixture and assert payload equality with `<name>.json`.
  3. Use only methods from `BufferReader`. NEVER reach into the raw buffer.
- Acceptance Criteria:
  - All 12 packets ported.
  - All snapshot tests pass.
- Verification:
  - `bun test packages/protocol/src/packets/incoming/core/`.
- Deliverables: 12 packet modules + tests.

---

### P3-T4 — Remaining Incoming Packets

- ID: P3-T4
- Owner: protocol-engineer
- Status: planned
- Dependencies: P3-T3
- Write Scope:
  - `packages/protocol/src/packets/incoming/aux/` (NEW directory)
  - `packages/protocol/src/packets/incoming/aux/index.ts` (NEW)
  - `packages/protocol/src/packets/incoming/aux/*.test.ts` (NEW)
- Read Context:
  - all remaining files under `packets/` not ported in P3-T2/T3
- Instructions:
  1. Port every remaining packet so total count equals legacy count (50 across all directories — confirm exact count with `find packets -type f -name '*.js' | wc -l` before claiming done).
  2. Where no fixture exists, author a hand-built fixture from a small representative payload and add it to `test/fixtures/packets/`.
- Acceptance Criteria:
  - Total ported packet count matches legacy count.
  - All packets have at least one decode test.
- Verification:
  - `bun test packages/protocol/src/packets/incoming/aux/`.
- Deliverables: remaining packet modules + tests.

---

### P3-T5 — Multi-subpacket Frame Decoder

- ID: P3-T5
- Owner: protocol-engineer
- Status: planned
- Dependencies: P3-T1, P3-T2, P3-T3
- Write Scope:
  - `packages/protocol/src/frameDecoder.ts` (NEW)
  - `packages/protocol/src/frameDecoder.test.ts` (NEW)
- Read Context:
  - `artemisNet.js` §`onPacket`
- Instructions:
  1. Implement `decodeFrame(buffer: Buffer, registry: PacketRegistry): { events: PacketEvent[]; tail: Buffer; outcome: DecodeResult<void> }`.
  2. Validate magic `0xdeadbeef`, `packetLength === bytesRemaining + 20`, multi-subpacket loop.
  3. On unknown subtype: return a `{ kind: "unknown", ... }` outcome; advance pointer by `packetLength`; do NOT reuse the previous `packetDef`.
  4. On split frames: return `{ kind: "incomplete", need: <bytes> }` and the original buffer as `tail`.
  5. Tests: `multi-subpacket.bin`, `split-across-chunks.bin`, `unknown-type.bin`, `unknown-subtype.bin` all produce expected outcomes.
- Acceptance Criteria:
  - All four edge-case fixtures pass.
  - Pointer never advances beyond `packetLength` on unknown packets.
- Verification:
  - `bun test packages/protocol/src/frameDecoder.test.ts`.
- Deliverables: frame decoder + tests.

---

### P4-T1 — World Model Types & Initial State

- ID: P4-T1
- Owner: domain-engineer
- Status: planned
- Dependencies: P3 complete
- Write Scope:
  - `packages/domain/src/model.ts` (NEW)
  - `packages/domain/src/model.test.ts` (NEW)
- Read Context:
  - `public/javascripts/worldmodel.js`
  - `docs/current-architecture-and-review.md` §"Behavior to preserve"
- Instructions:
  1. Define `WorldModel` interface covering all fields the legacy global `model` exposes: entities (by id), comms[], incomingAudio[], intel{}, shipSettings, weapons{}, engineering{}, damcon[], skybox, difficulty, started, paused, gameOver{}, serverVersion, serverIPs, vesselFactionData.
  2. Define entity discriminated union by entity type byte (player ship, npc, station, mine, drone, etc.) using legacy mapping.
  3. Implement `createInitialWorldModel(config: { playerShipIndex: number }): WorldModel`.
  4. Tests: shape sanity, default values, deep-immutability invariant.
- Acceptance Criteria:
  - All legacy model fields represented as typed properties.
  - `createInitialWorldModel` is pure (no I/O).
- Verification:
  - `bun test packages/domain/src/model.test.ts`.
- Deliverables: types + initial-state factory.

---

### P4-T2 — Packet → Domain Event Mapping

- ID: P4-T2
- Owner: domain-engineer
- Status: planned
- Dependencies: P4-T1
- Write Scope:
  - `packages/domain/src/events.ts` (NEW)
  - `packages/domain/src/mapPacket.ts` (NEW)
  - `packages/domain/src/mapPacket.test.ts` (NEW)
- Read Context:
  - `packages/protocol/src/packets/**`
- Instructions:
  1. Define `DomainEvent` discriminated union: `entityUpdated`, `entityDestroyed`, `ownShipUpdated`, `gameOver`, `connectionChanged`, `commsReceived`, `intelReceived`, `damconUpdated`, `shipSettingsUpdated`, `weaponsUpdated`, `engineeringUpdated`, `difficultyChanged`, `pauseToggled`, `versionReceived`, `welcomeReceived`.
  2. Implement `mapPacketToDomainEvents(packetEvent): DomainEvent[]` covering all 50 packets (some yield zero events).
  3. Tests: every packet name has a mapping test using fixtures.
- Acceptance Criteria:
  - Mapping is exhaustive over packet names (compiler enforced).
- Verification:
  - `bun test packages/domain/src/mapPacket.test.ts`.
- Deliverables: event types + mapper.

---

### P4-T3 — World Model Reducer

- ID: P4-T3
- Owner: domain-engineer
- Status: planned
- Dependencies: P4-T1, P4-T2
- Write Scope:
  - `packages/domain/src/reducer.ts` (NEW)
  - `packages/domain/src/reducer.test.ts` (NEW)
- Read Context:
  - `public/javascripts/worldmodel.js` (all `artemisNet.on(...)` callbacks)
- Instructions:
  1. Implement `applyDomainEvent(model, event): WorldModel` returning a structurally shared next state. Use Immer or hand-rolled structural sharing — choose one in an ADR comment in the file.
  2. Reproduce all legacy mutation behaviors: entity lifecycle, own-ship detection, comms-string null trimming, game-over reset, station/ship settings, etc.
  3. Tests: replay each fixture sequence (`welcome → playerUpdate → npcUpdate → weaponsUpdate → gameOverReason`) and assert final-state shape.
- Acceptance Criteria:
  - Replay tests pass for every packet sequence captured in P0-T2.
  - No I/O in the reducer.
- Verification:
  - `bun test packages/domain/src/reducer.test.ts`.
- Deliverables: reducer + tests.

---

### P4-T4 — Selectors

- ID: P4-T4
- Owner: domain-engineer
- Status: planned
- Dependencies: P4-T3
- Write Scope:
  - `packages/domain/src/selectors/` (NEW: bearings.ts, proximity.ts, tubes.ts, connection.ts, debugMap.ts, index.ts)
  - `packages/domain/src/selectors/*.test.ts` (NEW)
- Read Context:
  - `public/javascripts/bearing-table.js`
  - `public/javascripts/proximity.js`
  - `public/javascripts/tubes.js`
  - `public/javascripts/connectionlost.js`
  - `public/javascripts/map.js`
- Instructions:
  1. Implement: `selectOwnShip`, `selectNearestVessels`, `selectBearingRows(model, maxRows)`, `selectProximityDistances`, `selectProximityStatus`, `selectShieldStatus`, `selectTubeRows`, `selectStores`, `selectTubeCellState`, `selectConnectionOverlay`, `selectDebugMapEntities`.
  2. Each selector is pure and memoizable (export raw + `createMemoized<X>` wrapper).
  3. Tests assert numerical equivalence with legacy DOM-derived values for fixture models (build small reference snapshots from legacy code observation; document in test comments).
- Acceptance Criteria:
  - Every selector has at least one fixture-driven test.
  - No DOM, no React, no I/O.
- Verification:
  - `bun test packages/domain/src/selectors/`.
- Deliverables: selectors + tests.

---

### P4-T5 — Angles & Prettyprint Pure Functions

- ID: P4-T5
- Owner: domain-engineer
- Status: planned
- Dependencies: P4-T1
- Write Scope:
  - `packages/domain/src/util/angles.ts` (NEW)
  - `packages/domain/src/util/prettyprint.ts` (NEW)
  - `packages/domain/src/util/*.test.ts` (NEW)
- Read Context:
  - `public/javascripts/angles.js`
  - `public/javascripts/prettyprint.js`
- Instructions:
  1. Port every exported function 1:1, with explicit `number` types and unit comments (degrees vs radians, meters vs game units).
  2. Tests: for each function, table-driven cases with at least 8 representative inputs covering quadrants, negatives, zeros, and large values.
- Acceptance Criteria:
  - Identical numerical output vs legacy on table-driven inputs (within 1e-9 tolerance).
- Verification:
  - `bun test packages/domain/src/util/`.
- Deliverables: utilities + tests.

---

### P5-T1 — XML Parser ADR

- ID: P5-T1
- Owner: domain-engineer
- Status: planned
- Dependencies: P1-T1
- Write Scope:
  - `docs/adr/0001-xml-parser-choice.md` (NEW)
  - `packages/domain/package.json` (add chosen dependency only — additive edit)
- Read Context:
  - `vesselData.js`
  - `node_modules/node-xml-lite` (if installable) OR docs of candidates
- Instructions:
  1. Compare candidates: `fast-xml-parser`, `txml`, `htmlparser2`, hand-rolled.
  2. Evaluate against criteria: TypeScript types, maintenance, bundle size, edge cases of `vesselData.xml` (BOM handling, attributes-only nodes, child collections).
  3. Pick one and document in ADR.
- Acceptance Criteria:
  - ADR committed; one dependency added to `packages/domain/package.json`.
- Verification:
  - `bun install` succeeds.
- Deliverables: ADR + dep.

---

### P5-T2 — Vessel Data Loader (typed API)

- ID: P5-T2
- Owner: domain-engineer
- Status: planned
- Dependencies: P5-T1, P4-T1
- Write Scope:
  - `packages/domain/src/vesselData.ts` (NEW)
  - `packages/domain/src/vesselData.test.ts` (NEW)
  - `test/fixtures/dat/` (NEW; small synthetic vesselData.xml + one .snt)
- Read Context:
  - `vesselData.js`
- Instructions:
  1. Export `findDatDir(candidates: string[]): string | null` — pure function over a candidate list, no env/fs side effects beyond `fs.existsSync`.
  2. Export `loadVesselData(datDir: string): LoadVesselDataResult` returning `{ ok: true; data } | { ok: false; error; partial? }`.
  3. Resolve `.snt` files relative to `datDir` (FIX the legacy `dir` undefined bug).
  4. Provide synthetic fixture XML and `.snt` under `test/fixtures/dat/` so tests are hermetic.
- Acceptance Criteria:
  - Missing dat dir returns `{ ok: false, error: { kind: "missing-dat-dir" } }` (does NOT throw).
  - Valid fixtures produce expected factions + at least one vessel with parsed grid.
- Verification:
  - `bun test packages/domain/src/vesselData.test.ts`.
- Deliverables: loader + tests + fixtures.

---

### P5-T3 — `.snt` Grid Parser

- ID: P5-T3
- Owner: domain-engineer
- Status: planned
- Dependencies: P5-T2
- Write Scope:
  - `packages/domain/src/sntParser.ts` (NEW)
  - `packages/domain/src/sntParser.test.ts` (NEW)
- Read Context:
  - `vesselData.js` §`readSnt`
- Instructions:
  1. Implement `parseSnt(buffer: Buffer): SntGrid` returning `Record<-2..2, Record<-2..2, Record<0..9, SntCell | null>>>` typed via const-tuple keys.
  2. Pure function; no `fs` access.
  3. Reproduce legacy semantics: skip cells where `sys === -2`.
  4. Tests against the synthetic `.snt` from P5-T2 fixtures.
- Acceptance Criteria:
  - Hermetic test passes.
  - 100% line + branch coverage on `sntParser.ts`.
- Verification:
  - `bun test packages/domain/src/sntParser.test.ts`.
- Deliverables: parser + tests.

---

### P5-T4 — `dir` Bug Regression Test

- ID: P5-T4
- Owner: test-engineer
- Status: planned
- Dependencies: P5-T2, P5-T3
- Write Scope:
  - `packages/domain/src/vesselData.regression.test.ts` (NEW)
- Read Context:
  - `vesselData.js:90`
  - `docs/current-architecture-and-review.md` §"P1: Vessel `.snt` Loading References An Undefined Variable"
- Instructions:
  1. Author a test that, given a vesselData fixture containing a vessel with `internal_data`, loads the data and asserts the `.snt` grid is present and non-empty.
  2. Add an inline comment explaining the bug in legacy `vesselData.js` and citing `current-architecture-and-review.md`.
- Acceptance Criteria:
  - Test passes against `packages/domain/src/vesselData.ts` (the fix).
  - Test would FAIL if run against legacy code (commented assertion of intent).
- Verification:
  - `bun test packages/domain/src/vesselData.regression.test.ts`.
- Deliverables: regression test.

---

### P6-T1 — Typed Config & CLI

- ID: P6-T1
- Owner: server-engineer
- Status: planned
- Dependencies: P1-T5
- Write Scope:
  - `packages/config/src/loadConfig.ts` (NEW)
  - `packages/config/src/cli.ts` (NEW)
  - `packages/config/src/*.test.ts` (NEW)
- Read Context:
  - `config/default.yaml`
  - `app.js` §214–222 (CLI parsing)
- Instructions:
  1. Define typed `Config` schema (zod): `tcpPort: number = 3000`, `artemisServerAddr: string | null`, `playerShipIndex: 0..7`, `headless: boolean = false`, `datDir: string | null`.
  2. Merge precedence: defaults → `config/default.yaml` → env (`GLITTER_*`) → CLI flags.
  3. CLI flags: `--headless`, `--server <addr>`, `--port <port>`, `--dat-dir <path>`, `--ship-index <n>`, `--help`.
  4. Tests: each precedence layer + invalid value rejection.
- Acceptance Criteria:
  - Invalid configs throw zod validation errors with field paths.
- Verification:
  - `bun test packages/config/`.
- Deliverables: config loader + CLI parser.

---

### P6-T2 — Artemis Client Wrapper (state machine)

- ID: P6-T2
- Owner: server-engineer
- Status: planned
- Dependencies: P3 complete, P6-T1
- Write Scope:
  - `apps/server/src/artemis/client.ts` (NEW)
  - `apps/server/src/artemis/connectionState.ts` (NEW)
  - `apps/server/src/artemis/client.test.ts` (NEW; integration test against fake Artemis)
- Read Context:
  - `artemisNet.js`
  - `test/fake-artemis/**` (from P0-T3)
  - `packages/protocol/src/frameDecoder.ts`
- Instructions:
  1. Use `node:net` (NOT `Bun.connect` yet — per A9).
  2. State machine: `idle → connecting → connected → disconnecting → retrying → failed`. Emit typed events.
  3. Buffer-accumulator: feed bytes into `frameDecoder.decodeFrame`; on `incomplete`, retain tail; on `unknown`/`malformed`, log structured warning + advance.
  4. `send(commandName, payload): EncodeResult` checks state before writing.
  5. Tests run against the fake Artemis server: connect, receive welcome, send fireTube, receive recorded bytes match.
- Acceptance Criteria:
  - State transitions covered by tests.
  - `send` returns error variant when not connected.
  - Integration test passes against fake Artemis.
- Verification:
  - `bun test apps/server/src/artemis/`.
- Deliverables: client + state machine + integration test.

---

### P6-T3 — HTTP API Routes (POST commands)

- ID: P6-T3
- Owner: server-engineer
- Status: planned
- Dependencies: P6-T2
- Write Scope:
  - `apps/server/src/http/routes.ts` (NEW)
  - `apps/server/src/http/api.ts` (NEW)
  - `apps/server/src/http/static.ts` (NEW)
  - `apps/server/src/http/*.test.ts` (NEW)
- Read Context:
  - migration plan §"API Contract Sketch"
  - `app.js` (legacy GET routes)
- Instructions:
  1. Use `Bun.serve` with `routes` map. Methods: GET for read endpoints, POST for command endpoints.
  2. Endpoints:
     - `GET /api/status`
     - `GET /api/model`
     - `GET /api/glitter-addresses`
     - `POST /api/connect` (body `{ server, retries? }`)
     - `POST /api/disconnect`
     - `POST /api/ship-select` (body `{ playerShipIndex }`)
     - `POST /api/tubes/:tube/load` (body `{ ordnance }`)
     - `POST /api/tubes/:tube/unload`
     - `POST /api/tubes/:tube/fire`
  3. Static fallback serves `apps/web/dist/**` if present.
  4. NO `GET` route accepts a state-changing param. Legacy unsafe GET routes are NOT replicated.
- Acceptance Criteria:
  - All endpoints respond with `ApiResult<T>`.
  - No state-changing GET route exists.
- Verification:
  - `bun test apps/server/src/http/`.
- Deliverables: route handlers + tests.

---

### P6-T4 — Request Validation (zod)

- ID: P6-T4
- Owner: server-engineer
- Status: planned
- Dependencies: P6-T3
- Write Scope:
  - `packages/shared/src/apiSchemas.ts` (NEW)
  - `packages/shared/src/commands.ts` (NEW)
  - `packages/shared/src/realtimeEvents.ts` (NEW)
  - `packages/shared/src/*.test.ts` (NEW)
- Read Context:
  - migration plan §"Validation rules"
- Instructions:
  1. Author zod schemas for every request body and response shape.
  2. Validation rules:
     - `server`: hostname/IP regex.
     - `playerShipIndex`: integer 0..7.
     - `tube` route param: integer 1..6.
     - `ordnance`: integer 0..3.
     - Commands fail gracefully when Artemis is not connected — typed `{ ok: false, error: { code: "not-connected" } }`.
  3. Server endpoints (P6-T3) consume these schemas; export typed types for client (P7).
- Acceptance Criteria:
  - All endpoints validate via zod before execution.
  - Tests cover invalid + valid inputs.
- Verification:
  - `bun test packages/shared/`.
- Deliverables: schemas + tests.

---

### P6-T5 — WebSocket Broadcast Hub

- ID: P6-T5
- Owner: server-engineer
- Status: planned
- Dependencies: P6-T2, P6-T3
- Write Scope:
  - `apps/server/src/realtime/websocketHub.ts` (NEW)
  - `apps/server/src/realtime/events.ts` (NEW)
  - `apps/server/src/realtime/*.test.ts` (NEW)
- Read Context:
  - `app.js:99` (legacy listener leak)
  - migration plan §"Real-time transport"
- Instructions:
  1. Single Artemis listener registered ONCE at server startup. The listener publishes `RealtimeEvent` to a topic via `Bun.serve` websocket pub/sub API.
  2. Browsers connect once at `/api/realtime` and subscribe to relevant topics: `model`, `packets`, `connection`.
  3. Disconnect cleanup: only client subscription removal; the Artemis listener NEVER deregisters during normal operation.
  4. Tests: simulate N=10 client connect/disconnect cycles; assert Artemis client has exactly 1 listener throughout.
- Acceptance Criteria:
  - Artemis-side listener count is invariant under client churn.
  - Disconnected clients do not receive events.
- Verification:
  - `bun test apps/server/src/realtime/`.
- Deliverables: hub + events + tests.

---

### P6-T6 — Station Selection Sequence

- ID: P6-T6
- Owner: server-engineer
- Status: planned
- Dependencies: P6-T2
- Write Scope:
  - `apps/server/src/artemis/stationSelection.ts` (NEW)
  - `apps/server/src/artemis/stationSelection.test.ts` (NEW)
- Read Context:
  - `app.js` §`grabStations()`
- Instructions:
  1. On `welcome` event, send: `shipSelect(playerShipIndex)` → `setStation(0,1)` → `setStation(7,1)` → `setStation(9,1)` → `ready`.
  2. Make selection idempotent — if welcome arrives twice, do not duplicate.
  3. Tests: against fake Artemis, verify exact byte sequence in `getReceived()`.
- Acceptance Criteria:
  - Byte sequence exactly matches legacy `grabStations` semantics.
- Verification:
  - `bun test apps/server/src/artemis/stationSelection.test.ts`.
- Deliverables: selection module + test.

---

### P6-T7 — Glitter Address Discovery + GM Broadcast

- ID: P6-T7
- Owner: server-engineer
- Status: planned
- Dependencies: P6-T2
- Write Scope:
  - `apps/server/src/artemis/glitterAddress.ts` (NEW)
  - `apps/server/src/artemis/glitterAddress.test.ts` (NEW)
- Read Context:
  - `app.js:164` `/glitter-address`
  - `public/javascripts/worldmodel.js` (GM broadcast logic)
- Instructions:
  1. Discover non-loopback IPv4 addresses via `os.networkInterfaces()`.
  2. Expose `getGlitterAddresses(): string[]`.
  3. On `gameStarted` event, send a `gameMasterMessage` with the addresses (preserve legacy text format).
- Acceptance Criteria:
  - Test: mock interfaces, expect deterministic address list.
  - Integration: against fake Artemis, after `gameStarted`, recorded bytes contain the expected GM message.
- Verification:
  - `bun test apps/server/src/artemis/glitterAddress.test.ts`.
- Deliverables: address module + test.

---

### P6-T8 — Structured Logger

- ID: P6-T8
- Owner: server-engineer
- Status: planned
- Dependencies: P1-T5
- Write Scope:
  - `apps/server/src/diagnostics/logger.ts` (NEW)
  - `apps/server/src/diagnostics/logger.test.ts` (NEW)
- Read Context:
  - migration plan §"P3: Packet Parser Debugging And Production Logging Are Mixed"
- Instructions:
  1. Implement levels (`debug`, `info`, `warn`, `error`), JSON output by default, plain-text in TTY.
  2. Packet tracing behind `LOG_LEVEL=debug` and `GLITTER_TRACE_PACKETS=1` env flags.
  3. NEVER log raw `console.log(packetType, unpacked)` for high-volume packets unless trace flag is set.
- Acceptance Criteria:
  - Tests assert level filtering + flag gating.
- Verification:
  - `bun test apps/server/src/diagnostics/logger.test.ts`.
- Deliverables: logger + tests.

---

### P7-T1 — Web Build Config

- ID: P7-T1
- Owner: ui-engineer
- Status: planned
- Dependencies: P1-T5, P6-T3
- Write Scope:
  - `apps/web/vite.config.ts` (NEW; Vite is acceptable per migration plan)
  - `apps/web/index.html` (REPLACE stub)
  - `apps/web/package.json` (add web deps)
- Read Context:
  - migration plan §"React UI"
- Instructions:
  1. Vite + React + TanStack Router file-based routing plugin.
  2. Output to `apps/web/dist/`. Bun server serves this in production.
  3. Dev mode: Vite dev server on a separate port; web app proxies `/api/*` to Bun server.
- Acceptance Criteria:
  - `bun --filter @artemis-glitter/web build` succeeds.
  - `bun --filter @artemis-glitter/web dev` starts dev server.
- Verification:
  - Manual `bun --filter @artemis-glitter/web build` exit 0.
- Deliverables: vite config + html + deps.

---

### P7-T2 — Router & Root Layout

- ID: P7-T2
- Owner: ui-engineer
- Status: planned
- Dependencies: P7-T1
- Write Scope:
  - `apps/web/src/main.tsx` (NEW)
  - `apps/web/src/routes/__root.tsx` (NEW)
  - `apps/web/src/routes/index.tsx` (placeholder shell, no behavior yet)
  - `apps/web/src/routes/bearing-table.tsx` (placeholder)
  - `apps/web/src/routes/proximity.tsx` (placeholder)
  - `apps/web/src/routes/tubes.tsx` (placeholder)
  - `apps/web/src/routes/map.tsx` (placeholder)
  - `apps/web/src/routeTree.gen.ts` (generated)
- Read Context:
  - TanStack Router file-based routing docs (referenced in migration plan)
- Instructions:
  1. Configure file-based routing.
  2. Root layout includes a `<ConnectionOverlay />` slot (component added in P7-T5).
  3. Each placeholder route renders `"<route name> — placeholder"`.
- Acceptance Criteria:
  - All five routes navigable.
- Verification:
  - Manual: visit each route in dev server.
- Deliverables: routes + layout.

---

### P7-T3 — API Client + Query/Mutation Hooks

- ID: P7-T3
- Owner: ui-engineer
- Status: planned
- Dependencies: P7-T1, P6-T4
- Write Scope:
  - `apps/web/src/api/client.ts` (NEW)
  - `apps/web/src/api/queries.ts` (NEW)
  - `apps/web/src/api/mutations.ts` (NEW)
  - `apps/web/src/api/*.test.ts` (NEW)
- Read Context:
  - `packages/shared/src/apiSchemas.ts`
- Instructions:
  1. Author a typed fetch wrapper using zod schemas from `@artemis-glitter/shared`.
  2. Queries: `useStatusQuery`, `useModelQuery`, `useGlitterAddressesQuery`.
  3. Mutations: `useConnectMutation`, `useDisconnectMutation`, `useShipSelectMutation`, `useTubeLoadMutation`, `useTubeUnloadMutation`, `useTubeFireMutation`.
  4. Tests with a mock fetch; type tests for return shapes.
- Acceptance Criteria:
  - All hooks typed end-to-end.
- Verification:
  - `bun test apps/web/src/api/`.
- Deliverables: API hooks + tests.

---

### P7-T4 — Realtime Hook

- ID: P7-T4
- Owner: ui-engineer
- Status: planned
- Dependencies: P7-T1, P6-T5, P4 complete
- Write Scope:
  - `apps/web/src/realtime/useRealtimeModel.ts` (NEW)
  - `apps/web/src/realtime/store.ts` (NEW)
  - `apps/web/src/realtime/*.test.ts` (NEW)
- Read Context:
  - `packages/domain/src/reducer.ts`
  - `packages/shared/src/realtimeEvents.ts`
- Instructions:
  1. Open one WebSocket per browser tab to `/api/realtime`.
  2. Hydrate from `useModelQuery`; then apply realtime events through `applyDomainEvent`.
  3. Use `useSyncExternalStore` to expose model snapshots to components.
  4. Reconnect with exponential backoff (cap 5s).
  5. Tests with a mock WebSocket asserting hydration + event application.
- Acceptance Criteria:
  - Hook returns updated model after each simulated event.
  - Reconnect logic covered by tests.
- Verification:
  - `bun test apps/web/src/realtime/`.
- Deliverables: hook + store + tests.

---

### P7-T5 — Connection Overlay

- ID: P7-T5
- Owner: ui-engineer
- Status: planned
- Dependencies: P7-T2, P7-T4
- Write Scope:
  - `apps/web/src/components/ConnectionOverlay.tsx` (NEW)
  - `apps/web/src/components/ConnectionOverlay.test.tsx` (NEW)
- Read Context:
  - `public/javascripts/connectionlost.js`
  - `packages/domain/src/selectors/connection.ts`
- Instructions:
  1. Read `selectConnectionOverlay(model)`; render disconnected, simulation-not-started, game-over-stats variants.
  2. NO `innerHTML`. All dynamic strings rendered as React text nodes.
  3. Tests with React Testing Library asserting per-state rendering.
- Acceptance Criteria:
  - Component test passes for each overlay state.
  - Lint forbids `innerHTML` here.
- Verification:
  - `bun test apps/web/src/components/ConnectionOverlay.test.tsx`.
- Deliverables: component + tests.

---

### P7-T6 — CSS & Asset Bundling Baseline

- ID: P7-T6
- Owner: ui-engineer
- Status: planned
- Dependencies: P7-T1
- Write Scope:
  - `apps/web/src/styles/app.css` (NEW)
  - `apps/web/src/assets/` (NEW; copies of `public/stylesheets/**`, fonts, audio)
- Read Context:
  - `public/stylesheets/**`
  - `public/sounds/**` if present
  - `public/fonts/**` if present
- Instructions:
  1. Copy or import legacy CSS/fonts/sounds into the web app build pipeline.
  2. Maintain dense instrument-panel aesthetic.
  3. NEVER reference legacy URLs (e.g. `http://ol3js.org/`).
- Acceptance Criteria:
  - Production build embeds all required assets.
- Verification:
  - Manual: build artifact contains fonts/sounds.
- Deliverables: styles + assets.

---

### P8-T1 — Home Route

- ID: P8-T1
- Owner: ui-engineer
- Status: planned
- Dependencies: P7 complete
- Write Scope:
  - `apps/web/src/routes/index.tsx` (REPLACE placeholder)
  - `apps/web/src/components/Home/` (NEW)
  - `apps/web/src/components/Home/*.test.tsx` (NEW)
- Read Context:
  - `views/index.ejs`
  - `public/javascripts/serverstatus.js`
- Instructions:
  1. Server address input + connect/disconnect (`useConnectMutation` / `useDisconnectMutation`).
  2. Glitter address display via `useGlitterAddressesQuery`.
  3. Ship selector wired to `useShipSelectMutation`.
  4. Console links (`/bearing-table`, `/proximity`, `/tubes`, `/map`).
  5. Fix legacy bug: render `publicIPs[i]` not `publicIPs[0]`; assign to `.innerHTML` is gone — React text nodes only.
- Acceptance Criteria:
  - Visual parity vs P0 baseline.
  - Component tests pass.
  - E2E smoke: connect to fake Artemis from this route.
- Verification:
  - `bun test apps/web/src/components/Home/`.
- Deliverables: home route + components + tests.

---

### P8-T2 — Bearing Table Route

- ID: P8-T2
- Owner: ui-engineer
- Status: planned
- Dependencies: P7 complete, P4-T4 (selectors)
- Write Scope:
  - `apps/web/src/routes/bearing-table.tsx` (REPLACE)
  - `apps/web/src/components/BearingTable/` (NEW)
  - `apps/web/src/components/BearingTable/*.test.tsx` (NEW)
- Read Context:
  - `views/bearing-table.ejs`
  - `public/javascripts/bearing-table.js`
- Instructions:
  1. Use `selectBearingRows(model, maxRows)` driven by `ResizeObserver` rather than 100ms interval.
  2. Memoize per-row rendering.
  3. Match legacy color logic.
- Acceptance Criteria:
  - Visual parity at three breakpoints.
  - No DOM mutation outside React.
- Verification:
  - `bun test apps/web/src/components/BearingTable/`.
- Deliverables: route + component + tests.

---

### P8-T3 — Proximity Route

- ID: P8-T3
- Owner: ui-engineer
- Status: planned
- Dependencies: P7 complete, P4-T4
- Write Scope:
  - `apps/web/src/routes/proximity.tsx` (REPLACE)
  - `apps/web/src/components/ProximityMonitor/` (NEW)
  - `apps/web/src/components/ProximityMonitor/*.test.tsx` (NEW)
- Read Context:
  - `views/proximity.ejs`
  - `public/javascripts/proximity.js`
- Instructions:
  1. Use `selectProximityStatus`, `selectProximityDistances`, `selectShieldStatus`.
  2. Audio alert via `useAudioAlert(status)` hook (memoize lazy-loaded `Audio` instances).
  3. Status precedence preserved: nebula → hazard → enemy → red alert → mine → drone → default.
  4. Fix legacy bug: ensure no path leaves `checkingProximity` true after early return.
- Acceptance Criteria:
  - Status precedence test fixture passes.
  - Audio plays exactly once per status transition.
- Verification:
  - `bun test apps/web/src/components/ProximityMonitor/`.
- Deliverables: route + component + tests.

---

### P8-T4 — Tubes Route

- ID: P8-T4
- Owner: ui-engineer
- Status: planned
- Dependencies: P7 complete, P4-T4
- Write Scope:
  - `apps/web/src/routes/tubes.tsx` (REPLACE)
  - `apps/web/src/components/TubeMatrix/` (NEW)
  - `apps/web/src/components/TubeMatrix/*.test.tsx` (NEW)
- Read Context:
  - `views/tubes.ejs`
  - `public/javascripts/tubes.js`
- Instructions:
  1. Use `selectTubeRows`, `selectStores`, `selectTubeCellState`.
  2. Wire to `useTubeLoadMutation`, `useTubeUnloadMutation`, `useTubeFireMutation`.
  3. Pending auto-load logic preserved as explicit local state with tests.
- Acceptance Criteria:
  - All three mutations exercised by component tests.
  - Disabled state for in-flight commands.
- Verification:
  - `bun test apps/web/src/components/TubeMatrix/`.
- Deliverables: route + component + tests.

---

### P8-T5 — Debug Map Route

- ID: P8-T5
- Owner: ui-engineer
- Status: planned
- Dependencies: P7 complete, P4-T4
- Write Scope:
  - `apps/web/src/routes/map.tsx` (REPLACE)
  - `apps/web/src/components/DebugMap/` (NEW)
  - `apps/web/src/components/DebugMap/*.test.tsx` (NEW)
- Read Context:
  - `views/map.ejs`
  - `public/javascripts/map.js`
- Instructions:
  1. Replace OpenLayers with a first-party Canvas/SVG component (entity dots/labels/selection only).
  2. NEVER reference `http://ol3js.org/`.
  3. Use `selectDebugMapEntities`.
- Acceptance Criteria:
  - Entity selection toggles details panel.
  - Coordinate transform parity with legacy.
- Verification:
  - `bun test apps/web/src/components/DebugMap/`.
- Deliverables: route + component + tests.

---

### P9-T1 — Delete Legacy Server Entrypoints

- ID: P9-T1
- Owner: tooling-engineer
- Status: planned
- Dependencies: ALL P8 tasks green
- Write Scope:
  - DELETE: `app.js`, `artemisNet.js`, `artemisBufferReader.js`, `vesselData.js`
  - DELETE: `routes/` (entire directory)
  - DELETE: `views/` (entire directory)
  - DELETE: `packets/` (entire directory)
- Read Context:
  - none new — relies on prior phase exit criteria
- Instructions:
  1. Delete the listed files/directories. DO NOT touch `apps/`, `packages/`, or `test/`.
  2. Update root `package.json`: remove `legacy:start` script, remove `legacyDependencies` block, delete `LEGACY-DEPENDENCIES.md`.
- Acceptance Criteria:
  - `bun run typecheck`, `bun test`, `bun run lint` all green AFTER deletion.
- Verification:
  - `find . -maxdepth 2 -name 'app.js' -o -name 'artemisNet.js'` returns no results.
- Deliverables: deletions + cleaned `package.json`.

---

### P9-T2 — Delete Legacy Public Scripts

- ID: P9-T2
- Owner: tooling-engineer
- Status: planned
- Dependencies: P9-T1
- Write Scope:
  - DELETE: `public/javascripts/` (entire directory)
  - PRESERVE: `public/stylesheets/`, `public/sounds/`, `public/fonts/` ONLY IF NOT already migrated to `apps/web/src/assets/`
- Read Context:
  - `apps/web/src/assets/` (verify migration completed)
- Instructions:
  1. Confirm every asset under `public/stylesheets|sounds|fonts` has a counterpart in `apps/web/src/assets/`. If yes, delete `public/`.
  2. Otherwise, migrate the missing assets first, then delete `public/`.
- Acceptance Criteria:
  - `public/` directory deleted at end of task.
- Verification:
  - `ls public/ 2>/dev/null` returns no entries (or directory missing).
- Deliverables: cleaned `public/`.

---

### P9-T3 — Remove Grunt + node-webkit

- ID: P9-T3
- Owner: tooling-engineer
- Status: planned
- Dependencies: P9-T1
- Write Scope:
  - DELETE: `Gruntfile.js`, `server-page.html`
  - EDIT: `package.json` (remove `main`, `window` fields, any node-webkit references)
- Instructions:
  1. Delete files; clean `package.json`.
- Acceptance Criteria:
  - No reference to `grunt`, `node-webkit`, `nw.gui` anywhere in the repo.
- Verification:
  - `grep -r 'node-webkit\|nw.gui\|Gruntfile' --exclude-dir=.git .` returns no hits.
- Deliverables: cleanup.

---

### P9-T4 — README Refresh

- ID: P9-T4
- Owner: docs-engineer
- Status: planned
- Dependencies: P9-T1, P9-T2, P9-T3
- Write Scope:
  - `README.md` (REPLACE legacy build/run instructions with Bun-based instructions)
  - `docs/README.md` (UPDATE if needed)
- Instructions:
  1. Replace install instructions with `bun install --frozen-lockfile`.
  2. Replace run instructions with `bun run dev`.
  3. Document `--headless`, `--server`, `--port`, `--dat-dir`, `--ship-index`.
  4. Add a "Test" section: `bun test`, `bun run typecheck`, `bun run lint`.
  5. Mention `bun build --compile` plan in a "Distribution" subsection (Phase 10).
- Acceptance Criteria:
  - No mention of `npm install`, `grunt`, `node-webkit`.
- Verification:
  - `grep -i 'grunt\|node-webkit\|npm install' README.md` returns no hits.
- Deliverables: refreshed README.

---

### P9-T5 — Final Sweep

- ID: P9-T5
- Owner: tooling-engineer
- Status: planned
- Dependencies: P9-T1..T4
- Write Scope:
  - none (verification-only); may produce `docs/migration-completion-report.md` (NEW)
- Instructions:
  1. Run full CI: `bun install --frozen-lockfile && bun run typecheck && bun test && bun run lint && bun run format -- --check`.
  2. Tighten lint: change `any` from warn to error.
  3. Produce a brief migration-completion report.
- Acceptance Criteria:
  - All commands exit 0.
- Verification:
  - `bash scripts/ci/run-all.sh` exit 0.
- Deliverables: completion report.

---

### P10-T1 — Production Web Build Embedded into Server

- ID: P10-T1
- Owner: tooling-engineer
- Status: planned
- Dependencies: P9 complete
- Write Scope:
  - `apps/server/src/http/static.ts` (UPDATE to import compiled `apps/web/dist`)
  - `apps/server/build.ts` (NEW; orchestrates web build + server bundle)
- Instructions:
  1. `apps/server/build.ts` runs `bun --filter @artemis-glitter/web build`, then bundles server with embedded asset map.
- Acceptance Criteria:
  - `bun run apps/server/build.ts` produces a self-contained server bundle that serves the React app on port 3000.
- Verification:
  - Manual: run bundle, hit `/`, confirm React app loads with no `apps/web/dist` directory present at runtime.
- Deliverables: build script + updated static handler.

---

### P10-T2 — `bun build --compile` per Platform

- ID: P10-T2
- Owner: tooling-engineer
- Status: planned
- Dependencies: P10-T1
- Write Scope:
  - `scripts/dist/compile.ts` (NEW)
  - `scripts/dist/targets.json` (NEW)
- Instructions:
  1. Use `bun build --compile --target=...` for at least the host platform; document additional targets.
  2. Output to `dist/` with platform-suffixed filenames.
- Acceptance Criteria:
  - One platform produces a runnable single-file binary.
- Verification:
  - Manual: run binary, connect to fake Artemis, hit UI.
- Deliverables: compile scripts + first binary.

---

### P10-T3 — Release Artifact Docs

- ID: P10-T3
- Owner: docs-engineer
- Status: planned
- Dependencies: P10-T2
- Write Scope:
  - `docs/distribution.md` (NEW)
  - `LICENSE` (PRESERVE, ensure listed)
  - `THIRD_PARTY_NOTICES.md` (NEW)
- Instructions:
  1. Document install/run for each compiled binary.
  2. Document config/CLI lookup order.
  3. Aggregate license attributions for runtime deps.
- Acceptance Criteria:
  - All runtime deps attributed.
- Verification:
  - Manual review.
- Deliverables: docs.

## 6. Parallel Execution Matrix

### Wave 1 — Immediate Start (no dependencies)
Run all of these in parallel as soon as orchestration begins:
- P0-T1 (docs-engineer) — route+packet inventory
- P0-T4 (test-engineer) — DOM/screenshot baselines
- P1-T1 (tooling-engineer) — Bun workspace root + lockfile

### Wave 2 — Unlocked by Wave 1 foundations
- P0-T2 (test-engineer) — fixture corpus *(needs P0-T1)*
- P1-T2 (tooling-engineer) — TypeScript config *(needs P1-T1)*
- P1-T3 (tooling-engineer) — eslint/prettier *(needs P1-T1)*

### Wave 3 — Unlocked by Wave 2
- P0-T3 (test-engineer) — fake Artemis TCP server *(needs P0-T2)*
- P1-T4 (tooling-engineer) — CI scripts *(needs P1-T1/T2/T3)*
- P1-T5 (tooling-engineer) — empty package skeletons *(needs P1-T1, P1-T2)*
- P5-T1 (domain-engineer) — XML parser ADR *(needs P1-T1; runs in parallel with protocol/domain pipeline)*

### Wave 4 — Protocol pipeline (sequential within, but independent of UI work)
- P2-T1 (protocol-engineer) — BufferReader *(needs P0-T2, P1-T5)*
- P2-T2 (protocol-engineer) — BufferWriter *(needs P0-T2, P1-T5)* — CAN run parallel with P2-T1 (disjoint files)
- P2-T3 (protocol-engineer) — codec result types *(needs P2-T1, P2-T2)*

### Wave 5 — Packet definitions (parallel within)
- P3-T1 (protocol-engineer) — registry shape
- P3-T2 (protocol-engineer) — outgoing client actions *(needs P3-T1)*
- P3-T3 (protocol-engineer) — core incoming packets *(needs P3-T1)* — CAN run parallel with P3-T2 (disjoint subtree)
- P3-T4 (protocol-engineer) — remaining packets *(needs P3-T3)*
- P3-T5 (protocol-engineer) — multi-subpacket frame decoder *(needs P3-T1/T2/T3)*

### Wave 6 — Domain pipeline (sequential within)
- P4-T1 (domain-engineer) — types
- P4-T2 (domain-engineer) — packet→event mapping *(needs P4-T1, P3 complete)*
- P4-T3 (domain-engineer) — reducer *(needs P4-T2)*
- P4-T4 (domain-engineer) — selectors *(needs P4-T3)*
- P4-T5 (domain-engineer) — angles + prettyprint *(needs P4-T1)* — CAN run parallel with P4-T2/T3/T4 (disjoint files)

### Wave 7 — Vessel data
- P5-T2 (domain-engineer) — typed loader *(needs P5-T1, P4-T1)*
- P5-T3 (domain-engineer) — `.snt` parser *(needs P5-T2)* — actually disjoint files; can run parallel with P5-T2
- P5-T4 (test-engineer) — regression test *(needs P5-T2, P5-T3)*

### Wave 8 — Server pipeline (mostly sequential)
- P6-T1 (server-engineer) — typed config + CLI *(needs P1-T5)*
- P6-T8 (server-engineer) — structured logger *(needs P1-T5)* — CAN run parallel with P6-T1 (disjoint files)
- P6-T2 (server-engineer) — Artemis client wrapper *(needs P3 complete, P6-T1, P0-T3)*
- P6-T3 (server-engineer) — HTTP routes *(needs P6-T2)*
- P6-T4 (server-engineer) — request validation *(needs P6-T3)* — disjoint to T3 in package layout, can interleave
- P6-T5 (server-engineer) — websocket hub *(needs P6-T2, P6-T3)*
- P6-T6 (server-engineer) — station selection *(needs P6-T2)*
- P6-T7 (server-engineer) — glitter address *(needs P6-T2)*

### Wave 9 — UI pipeline
- P7-T1 (ui-engineer) — web build config *(needs P1-T5, P6-T3)*
- P7-T2 (ui-engineer) — router + layout *(needs P7-T1)*
- P7-T3 (ui-engineer) — API hooks *(needs P7-T1, P6-T4)*
- P7-T4 (ui-engineer) — realtime hook *(needs P7-T1, P6-T5, P4 complete)*
- P7-T5 (ui-engineer) — connection overlay *(needs P7-T2, P7-T4)*
- P7-T6 (ui-engineer) — assets baseline *(needs P7-T1)*

### Wave 10 — Console ports (FULLY PARALLEL — disjoint write scopes)
After P7 complete, all five run simultaneously:
- P8-T1 (ui-engineer) — Home
- P8-T2 (ui-engineer) — Bearing Table
- P8-T3 (ui-engineer) — Proximity
- P8-T4 (ui-engineer) — Tubes
- P8-T5 (ui-engineer) — Debug Map

NOTE: All five are owned by the `ui-engineer` role but go to **separate worker agent sessions** so write scopes never overlap. Orchestrator dispatches as five concurrent Task() calls.

### Wave 11 — Legacy cleanup (sequential)
- P9-T1 → P9-T2 → P9-T3 (parallel with P9-T2) → P9-T4 → P9-T5

### Wave 12 — Distribution
- P10-T1 → P10-T2 → P10-T3

### Sequential Blockers (cannot parallelize across)
- P0 → P3 (fixtures must precede protocol port)
- P3 → P4 (protocol must precede domain mapping)
- P4 → P6-T2 (server needs domain reducer)
- P6 → P7 (UI needs APIs)
- P7 → P8 (console ports need shell)
- P8 → P9 (legacy delete only after parity)
- P9 → P10 (distribution after legacy gone)

### Integration-Only Tasks
- P9-T5 (final sweep)
- P10-T3 (release docs)

## 7. Integration Sequence

After each phase, the orchestrator MUST run an integration checkpoint. Failure at a checkpoint blocks the next phase.

### Checkpoint after Phase 0
- All fixtures decoded by legacy `artemisBufferReader.js` produce expected JSON shadows.
- Fake Artemis TCP server responds correctly to a manual run of legacy `node app.js --server localhost --port-fake-artemis-hack`.

### Checkpoint after Phase 1
- `bun install --frozen-lockfile`, `bun run typecheck`, `bun test`, `bun run lint` all exit 0.
- Legacy `node --check app.js` still exits 0.

### Checkpoint after Phase 2
- All fixture-driven reader/writer tests pass.
- Round-trip `decode(encode(x)) === x` holds for all command payloads.

### Checkpoint after Phase 3
- All 50 packets decoded byte-identical to legacy fixtures.
- Multi-subpacket + split + unknown frame edge cases handled.

### Checkpoint after Phase 4
- Reducer replay over fixture sequences yields stable, expected world-model snapshots.
- Selectors numerically match legacy DOM-derived values.

### Checkpoint after Phase 5
- vesselData regression test (P5-T4) passes.
- Loader degrades gracefully on missing dat dir.

### Checkpoint after Phase 6
- New Bun server connects to fake Artemis TCP server, completes welcome → station selection → ready.
- POST commands validate and execute.
- Single Artemis listener invariant verified under N=10 client churn.

### Checkpoint after Phase 7
- React app renders all five route placeholders.
- ConnectionOverlay reflects every connection state from fake Artemis.
- WebSocket reconnect tested.

### Checkpoint after Phase 8
- Side-by-side comparison: legacy URL `/proximity` and new URL `/proximity` produce visually equivalent outputs against the same fake Artemis script.
- All E2E smoke tests pass.

### Checkpoint after Phase 9
- Repository contains no Express/EJS/Socket.IO/Grunt/node-webkit references.
- Full CI green.
- Manual test against a real Artemis server confirms protocol compatibility.

### Checkpoint after Phase 10
- Single-file binary runs the full app with no `node_modules/` present.

## 8. Verification Ladder

Each rung must pass before the next is run.

1. **Unit tests**: `bun test` per package and overall.
2. **Typecheck**: `bun run typecheck` (= `tsc -b --noEmit`). Bun transpiles but does NOT typecheck — typechecking is a SEPARATE CI step.
3. **Lint/Format**: `bun run lint` and `bun run format -- --check`.
4. **Fake Artemis TCP integration**: `bun test apps/server/` against `test/fake-artemis/`.
5. **Browser/UI smoke tests**: `bun test apps/web/` plus headless E2E (Playwright optional in P8/P10).
6. **Manual real-Artemis test**: USER runs the new app against a real Artemis SBS server and confirms welcome, station selection, model hydration, tube fire, game-over.

Promotion rule: a phase exits only when rungs 1–5 are green AND the phase's integration checkpoint is signed off. Rung 6 is required only at the Phase 9 checkpoint and the final Phase 10 checkpoint.

## 9. Residual Risks

- **R1. Real Artemis protocol drift.** Legacy code targets Artemis 2.1.1; fixture-driven testing cannot detect drift to a newer Artemis version. Mitigation: schedule a manual real-Artemis test at the Phase 9 checkpoint and again at Phase 10.
- **R2. `node-xml-lite` semantics replacement.** Picking a new XML parser may change BOM-handling or attribute-collection edge cases. Mitigation: P5-T1 ADR + side-by-side parsing test against captured `vesselData.xml`.
- **R3. Bun TCP buffering differences vs Node.** Even sticking with `node:net` under Bun, behavior under high-volume packet streams may differ. Mitigation: large-volume integration test with the fake Artemis emitting ~100 packets/sec for 60s.
- **R4. React rerender storms under packet flood.** Mitigation: store-based selectors, per-route throttling, profile in Phase 8.
- **R5. Asset migration drift.** Sounds/fonts moved from `public/` to `apps/web/src/assets/` may go missing. Mitigation: P9-T2 verifies migration completeness BEFORE deleting `public/`.
- **R6. node-webkit/`nw.gui` shim in `vesselData.js`.** Legacy `try { var gui = require('nw.gui'); ... }` is silently ignored under Node; the new loader drops it cleanly. Mitigation: P5-T2 explicitly omits nw.gui paths.
- **R7. Listener-leak regression after Phase 9.** Even with the broadcast hub, future code edits could re-introduce per-client listeners. Mitigation: P6-T5 invariant test runs in CI permanently.
- **R8. Worker-agent write-scope collisions.** If two parallel agents are dispatched without honoring the Parallelization Matrix, files may collide. Mitigation: orchestrator MUST verify Wave membership before each dispatch and never dispatch two agents with overlapping Write Scopes.
- **R9. Bun version churn.** Bun is a fast-moving runtime. Mitigation: pin a specific minor in `package.json#engines` and CI matrix.
- **R10. Test fixture incorrectness.** If a P0-T2 fixture is captured from a buggy legacy path, downstream tests anchor on the wrong bytes. Mitigation: where feasible, cross-check fixtures against the Artemis Packet Protocol reference doc cited in `README.md`.

## 10. Next Agent Prompt Template

This template is dispatched to a worker agent for ONE task card. The orchestrator pastes a single card into `<TASK_CARD>` and sends.

```text
You are a worker agent in the artemis-glitter migration.

Task card:
<TASK_CARD>

Rules:
- You are not alone in the codebase. Other agents may be editing different areas. Do not revert unrelated changes.
- Only edit files inside your assigned Write Scope.
- Read the listed Read Context before changing files.
- Follow the task card instructions and acceptance criteria exactly.
- Add or update tests requested by the task card.
- Run the verification commands from the task card when feasible.
- If a verification command fails because of your changes, fix it.
- If it fails because of unrelated repository state, report that clearly and stop.
- DO NOT delete files outside your Write Scope.
- DO NOT modify `package.json` unless your Write Scope explicitly includes it.
- DO NOT add dependencies unless your task card mentions them.
- DO NOT run `git commit`, `git push`, or create branches.
- Final response must list:
  - files changed (one per line, with absolute path)
  - verification commands run and their exit codes
  - any blockers or follow-up tasks discovered
  - any deviation from the task card and the reason
```

---

## Plan Self-Review Against H-Checklist

| Check | Status | Evidence |
|---|---|---|
| Every task has clear owner + write scope | ✅ | All 38 cards have both fields. |
| Protocol/domain/server/UI changes separated | ✅ | Packages: protocol, domain, shared, config, server, web — disjoint. |
| Tests planned BEFORE risky protocol rewrites | ✅ | P0-T2 (fixtures) + P0-T3 (fake Artemis) precede P2/P3. |
| Existing behavior preserved before improvements | ✅ | Strangler approach; legacy frozen until P9. |
| Command endpoints POST not GET | ✅ | P6-T3 explicitly forbids state-changing GET; legacy GET routes NOT replicated. |
| Single broadcast hub fixes Socket.IO leak | ✅ | P6-T5 with invariant test. |
| vesselData `.snt` `dir` bug has tests + fix | ✅ | P5-T2 (fix) + P5-T4 (regression). |
| Bun typecheck SEPARATE from transpile | ✅ | P1-T2 mandates `tsc -b --noEmit` as a distinct script. |
| No TanStack Start dependency unless justified | ✅ | A2 + plan §3.3 use TanStack Router + Query directly. |
| Packaging deferred to Phase 10 | ✅ | P10 cards explicitly final. |

## Final Summary

- TASK_COUNT: 53
- IMMEDIATE_START: P0-T1, P0-T4, P1-T1
- SEQUENTIAL_BLOCKERS: P0→P3, P3→P4, P4→P6-T2, P6→P7, P7→P8, P8→P9, P9→P10






