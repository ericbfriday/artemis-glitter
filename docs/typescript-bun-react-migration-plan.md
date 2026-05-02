# TypeScript Bun React Migration Plan

## Target Outcome

The final project should retain the current Artemis Glitter functionality while using:

- Bun as runtime, package manager, script runner, test runner, and build tool where practical.
- TypeScript for protocol, domain, server, shared contracts, and UI.
- React for UI rendering.
- TanStack Router for typed UI routes.
- TanStack Query for server-state snapshots and command mutation flows.
- A workspace/monorepo layout because protocol, domain, server, and UI are distinct enough to benefit from separate packages with explicit dependencies.

The recommended migration style is strangler-style rather than a rewrite. Keep a working application at each milestone, build tests around current behavior, then replace legacy pieces with typed modules.

## Current-To-Target Architecture

### Current

```text
app.js
  Express 3 + EJS + Socket.IO
  imports worldmodel.js in Node mode
  imports artemisNet.js

artemisNet.js
  TCP socket + packet framing + registry + event emitter + packet emit

packets/**
  CommonJS packet pack/unpack definitions

public/javascripts/worldmodel.js
  Node mode: listens to artemisNet, exports /model handler
  Browser mode: connects to Socket.IO, fetches /model, updates global model

views/** + public/javascripts/**
  EJS pages + global browser scripts + direct DOM mutation
```

### Target

```text
apps/server
  Bun runtime
  Bun.serve HTTP routes
  WebSocket transport or Socket.IO-compatible adapter if compatibility is required
  Artemis TCP client
  typed command/query API
  static React app serving

apps/web
  React
  TanStack Router routes
  TanStack Query for initial model snapshot, server status, commands, and mutations
  WebSocket client for real-time packet/model events

packages/protocol
  binary reader/writer
  packet definitions
  packet registry
  packet decoder/encoder
  packet fixtures and tests

packages/domain
  world-model types
  pure reducers
  selectors for proximity, bearings, tube state, connection overlays

packages/shared
  API schemas and shared event/command DTOs
  validation helpers

packages/config
  typed config loading
  CLI/env/config-file merge
```

## Why A Monorepo Makes Sense

A monorepo is justified because the project has multiple independently testable surfaces:

- The protocol package should not depend on React or server routes.
- The domain package should not know whether events came from TCP, WebSocket, or tests.
- The server package should own Bun-specific runtime integration.
- The web package should own UI rendering and route/data hooks.
- Shared API schemas should be versioned with both server and web.

Bun supports `workspaces` in `package.json`; its docs describe workspace installs, local workspace dependency linking, filtering commands by package, and running scripts across workspaces. This fits the migration because each package can be ported and tested independently while using one `bun.lock`.

## Proposed Repository Layout

```text
.
+-- apps
|   +-- server
|   |   +-- src
|   |   |   +-- index.ts
|   |   |   +-- http
|   |   |   |   +-- routes.ts
|   |   |   |   +-- api.ts
|   |   |   |   +-- static.ts
|   |   |   +-- realtime
|   |   |   |   +-- websocketHub.ts
|   |   |   |   +-- events.ts
|   |   |   +-- artemis
|   |   |   |   +-- client.ts
|   |   |   |   +-- connectionState.ts
|   |   |   |   +-- stationSelection.ts
|   |   |   +-- diagnostics
|   |   |       +-- logger.ts
|   |   +-- package.json
|   |   +-- tsconfig.json
|   +-- web
|       +-- src
|       |   +-- main.tsx
|       |   +-- routeTree.gen.ts
|       |   +-- routes
|       |   |   +-- __root.tsx
|       |   |   +-- index.tsx
|       |   |   +-- bearing-table.tsx
|       |   |   +-- proximity.tsx
|       |   |   +-- tubes.tsx
|       |   |   +-- map.tsx
|       |   +-- api
|       |   |   +-- client.ts
|       |   |   +-- queries.ts
|       |   |   +-- mutations.ts
|       |   +-- realtime
|       |   |   +-- useRealtimeModel.ts
|       |   +-- components
|       |   |   +-- ConnectionOverlay.tsx
|       |   |   +-- BearingTable.tsx
|       |   |   +-- ProximityMonitor.tsx
|       |   |   +-- TubeMatrix.tsx
|       |   |   +-- DebugMap.tsx
|       |   +-- styles
|       |   |   +-- app.css
|       |   +-- assets
|       +-- index.html
|       +-- package.json
|       +-- tsconfig.json
+-- packages
|   +-- protocol
|   |   +-- src
|   |   |   +-- BufferReader.ts
|   |   |   +-- BufferWriter.ts
|   |   |   +-- frameDecoder.ts
|   |   |   +-- frameEncoder.ts
|   |   |   +-- registry.ts
|   |   |   +-- packets
|   |   |   +-- types.ts
|   |   +-- tests
|   +-- domain
|   |   +-- src
|   |   |   +-- model.ts
|   |   |   +-- reducer.ts
|   |   |   +-- events.ts
|   |   |   +-- selectors
|   |   |   |   +-- bearings.ts
|   |   |   |   +-- proximity.ts
|   |   |   |   +-- tubes.ts
|   |   |   |   +-- connection.ts
|   |   |   +-- vesselData.ts
|   |   +-- tests
|   +-- shared
|   |   +-- src
|   |   |   +-- apiSchemas.ts
|   |   |   +-- commands.ts
|   |   |   +-- realtimeEvents.ts
|   |   +-- tests
|   +-- config
|       +-- src
|       |   +-- loadConfig.ts
|       |   +-- cli.ts
|       +-- tests
+-- public
|   +-- legacy-assets-to-migrate
+-- docs
+-- package.json
+-- bun.lock
+-- tsconfig.base.json
+-- eslint.config.js
+-- bunfig.toml
```

## Root Tooling

### Root `package.json`

Use Bun workspaces and scripts that run by filter:

```json
{
  "name": "artemis-glitter",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "bun --filter @artemis-glitter/server dev",
    "build": "bun --workspaces run build",
    "test": "bun --workspaces run test",
    "typecheck": "bun --workspaces run typecheck",
    "lint": "bun --workspaces run lint",
    "format": "prettier --check ."
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "latest"
  }
}
```

Pin actual versions during implementation instead of leaving `latest`; the snippet shows package classes, not final lockfile content.

### TypeScript Configuration

Use a strict base config aligned with Bun's recommendations:

- `target`: `ESNext`
- `module`: `Preserve`
- `moduleResolution`: `bundler`
- `jsx`: `react-jsx`
- `verbatimModuleSyntax`: `true`
- `strict`: `true`
- `noUncheckedIndexedAccess`: `true`
- `noFallthroughCasesInSwitch`: `true`
- `noImplicitOverride`: `true`
- `noEmit`: `true`
- `types`: `["bun"]` in Bun-targeted packages

Important: Bun can run and transpile TypeScript, but Bun's file-loader docs state that it strips TypeScript syntax and does not perform typechecking. CI must run `tsc --noEmit` or `tsc -b`.

### Linting And Formatting

Add:

- ESLint flat config with TypeScript rules.
- `eslint-plugin-react-hooks`.
- TanStack Query ESLint plugin for stable query client/deps patterns.
- Prettier or Biome. Prefer one formatter only.

Suggested rule posture:

- Treat unsafe `any` as warnings during migration, then ratchet to errors.
- Disallow floating promises in server/domain packages.
- Disallow direct DOM mutation in React packages.
- Disallow `innerHTML` except for reviewed, sanitized locations.

## Technology Decisions

### Bun Server

Use `Bun.serve` for the new HTTP server. Current Bun docs support static routes, dynamic routes, per-method handlers, wildcard routes, and HTML imports for full-stack apps. This can replace Express/EJS for server APIs and serving the React app.

Recommended API surface:

- `GET /api/status`
- `GET /api/model`
- `GET /api/config`
- `GET /api/artemis-server`
- `GET /api/glitter-addresses`
- `POST /api/connect`
- `POST /api/disconnect`
- `POST /api/ship-select`
- `POST /api/tubes/:tube/load`
- `POST /api/tubes/:tube/unload`
- `POST /api/tubes/:tube/fire`

Keep command endpoints as POST-only. Return structured JSON:

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; detail?: unknown } };
```

### Artemis TCP Client

Two viable paths:

1. First migration path: keep a Node-compatible `node:net` client running under Bun while porting and testing protocol code.
2. Final optimization path: switch to Bun's native `Bun.connect` TCP API after behavior is stable.

Start with option 1 unless Bun compatibility issues force earlier native TCP adoption. The reason is risk control: the current behavior depends on partial TCP buffer handling and packet framing, so changing both runtime and socket API at once raises the chance of protocol regressions.

If moving to `Bun.connect`, model the socket handlers as a single shared handler object. Bun's TCP docs note that this style avoids assigning event listeners per socket and reduces GC pressure.

### Real-Time Transport

The current app uses Socket.IO mostly as a packet event bus. The new app should use native WebSockets unless Socket.IO compatibility with existing clients is a requirement.

Use a server-side hub:

```ts
type RealtimeEvent =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "packet"; packetType: PacketName; data: PacketPayload }
  | { type: "modelPatch"; patch: ModelPatch }
  | { type: "error"; error: SerializedError };
```

Browser clients subscribe once. The server owns one listener to the Artemis client and broadcasts events to active clients. This directly fixes the current per-browser packet listener leak.

Bun's WebSocket docs support server-side WebSockets through `Bun.serve`, with shared handlers and a native publish-subscribe API. That is a good fit for packet topics such as `model`, `packets`, and `connection`.

### React UI

Use TanStack Router with file-based routing. TanStack's docs describe file-based routing as the preferred/recommended path, with route generation through supported bundlers or the Router CLI. This maps cleanly to the current route-per-console UI.

Routes:

- `/`: connect/ship/console selection.
- `/bearing-table`: bearing-distance table.
- `/proximity`: proximity monitor.
- `/tubes`: torpedo tubes matrix.
- `/map`: debug map.

Use TanStack Query for:

- Initial model fetch.
- Server status/config fetches.
- Connect/disconnect/ship-select/tube command mutations.
- Optional polling fallback if WebSocket connection is down.

Use a lightweight client store only for live model state. Options:

- `useSyncExternalStore` around a custom `WorldModelStore`.
- TanStack Store if the team wants to keep all TanStack client state in one family.
- Zustand if preferred, but it adds another ecosystem dependency.

Recommended approach: start with `useSyncExternalStore` plus pure reducers from `packages/domain`; add a store library only if React ergonomics demand it.

### TanStack Start Decision

TanStack Start is a full-stack React framework powered by TanStack Router and Vite. Its current docs say it is in Release Candidate stage. It provides SSR, streaming, server routes/API routes, server functions, middleware/context, and full-stack bundling.

For this project, use TanStack Router directly inside a Bun-served React app unless SSR or server functions become important. The existing app is a LAN dashboard with real-time client updates, not an SEO/content site. A simpler Bun server plus React SPA is easier to reason about and keeps the Artemis TCP process in one explicit runtime.

Revisit TanStack Start only if:

- The team wants framework-managed server routes.
- SSR becomes valuable for initial load.
- TanStack Start reaches stable v1 and has a well-supported Bun deployment path for this use case.

### Desktop/Distribution

The current node-webkit packaging can be replaced later. Bun supports single-file executables using `bun build --compile`, including cross-target builds and full-stack executables that contain server and frontend assets. This is a plausible replacement for distributing a local server app.

Recommended distribution plan:

1. First ship as `bun run start` from source.
2. Then create production server/client build artifacts.
3. Then evaluate `bun build --compile` for standalone CLI/server distribution.
4. If a GUI shell is still required, evaluate Bun WebView, Tauri, or another desktop wrapper after the core migration is stable.

## Migration Phases

### Phase 0: Baseline And Safety Net

Goal: make the current behavior observable before changing architecture.

Tasks:

1. Add docs and migration branch conventions.
2. Record current route inventory and packet inventory.
3. Add a minimal test harness around current JavaScript where practical.
4. Capture packet fixtures:
   - Complete single packet.
   - Split packet over two TCP chunks.
   - Multiple packets in one TCP chunk.
   - Unknown packet type.
   - Unknown subtype inside object update packet.
   - Outgoing load/fire/unload/ship-select packets.
5. Capture UI screenshots or DOM snapshots of current pages.
6. Create a fake Artemis TCP server for local E2E tests.

Exit criteria:

- Current code syntax checks pass.
- Fixtures exist for high-value packet paths.
- Fake Artemis server can simulate welcome, version, ship settings, player update, weapons update, and game-over.

### Phase 1: Create Bun Workspace Skeleton

Goal: introduce Bun and TypeScript without moving behavior yet.

Tasks:

1. Add root `package.json` workspaces.
2. Add `bun.lock` through `bun install`.
3. Add `tsconfig.base.json` and package `tsconfig.json` files.
4. Add `apps/server`, `apps/web`, and package folders.
5. Add CI scripts:
   - `bun install --frozen-lockfile`
   - `bun run typecheck`
   - `bun test`
   - `bun run lint`
6. Add path aliases through package exports, not opaque global aliases.

Exit criteria:

- Empty packages build/typecheck.
- Bun workspace commands run from root.
- Existing legacy app remains untouched and runnable if dependencies are installed.

### Phase 2: Port Binary Reader/Writer

Goal: move byte-level primitives into typed code.

Tasks:

1. Create `packages/protocol/src/BufferReader.ts`.
2. Create `packages/protocol/src/BufferWriter.ts`.
3. Replace `new Buffer(...)` patterns with safe `Buffer.alloc`.
4. Encode pointer bounds in methods:
   - `readUInt8`
   - `readUInt16LE`
   - `readUInt32LE`
   - `readFloatLE`
   - `readUtf16String`
   - `readAsciiString`
   - `readBitArray`
5. Return typed errors instead of throwing raw range errors for malformed packets.
6. Add tests for endianness, pointer advancement, string terminators, bit ordering, and buffer bounds.

Exit criteria:

- Reader/writer tests cover every method used by current packet definitions.
- Current packet fixture bytes can be read and written identically.

### Phase 3: Port Packet Registry And Definitions

Goal: preserve protocol behavior in typed packet modules.

Tasks:

1. Define packet interfaces:

```ts
type PacketDefinition<Name extends string, Payload> = {
  name: Name;
  type: number;
  subtype: number | null;
  subtypeLength: 0 | 1 | 4;
  decode?: (reader: BufferReader) => Payload;
  encode?: (writer: BufferWriter, payload: Payload) => void;
};
```

2. Port outgoing client actions first:
   - `ready`
   - `shipSelect`
   - `setStation`
   - `loadTube`
   - `unloadTube`
   - `fireTube`
   - `gameMasterMessage`
3. Port core incoming packets:
   - `welcome`
   - `version`
   - `consoleStatus`
   - `allShipSettings`
   - `playerUpdate`
   - `npcUpdate`
   - `stationUpdate`
   - `weaponsUpdate`
   - `engineeringUpdate`
   - `destroyObject`
   - `gameOverReason`
   - `gameOverStats`
4. Port remaining packets.
5. Replace recursive runtime `require` registration with static typed registry imports.
6. Add encode/decode snapshot tests for every packet that has fixture data.

Exit criteria:

- All existing 50 packet definitions are represented.
- Known fixture packets decode to the same payloads as legacy code.
- Outgoing packet byte snapshots match legacy output.

### Phase 4: Build Pure Domain Model

Goal: extract `worldmodel.js` behavior into a framework-independent package.

Tasks:

1. Define `WorldModel` type.
2. Define typed domain events produced from packet payloads.
3. Implement `createInitialWorldModel(config)`.
4. Implement `applyDomainEvent(model, event)` as either:
   - immutable reducer returning a new model, or
   - controlled mutable reducer with structural sharing at route selectors.
5. Preserve current entity type mapping.
6. Implement reset behavior for game over.
7. Implement own-ship detection from player ship index.
8. Implement comms string null trimming.
9. Implement selectors:
   - `selectOwnShip`
   - `selectNearestVessels`
   - `selectBearingRows`
   - `selectProximityStatus`
   - `selectTubeMatrix`
   - `selectConnectionOverlay`
   - `selectDebugMapEntities`
10. Port `angles.js` and `prettyprint.js` into typed pure functions.
11. Decide whether client-side position extrapolation belongs in domain selectors or a UI animation adapter.

Exit criteria:

- World-model reducer tests pass against captured packet sequences.
- Selectors produce current UI-equivalent values for fixture models.
- No domain package imports from server, browser globals, React, or Bun.

### Phase 5: Port Vessel Data Loader

Goal: make Artemis `vesselData.xml` and `.snt` loading explicit and testable.

Tasks:

1. Create `packages/domain/src/vesselData.ts`.
2. Replace `node-xml-lite` with one maintained XML parser, or use a small parser if the schema is simple enough.
3. Implement `findDatDir` separately from `loadVesselData`.
4. Fix the undefined `dir` bug by resolving `.snt` files from the final `datDir`.
5. Add result types:

```ts
type LoadVesselDataResult =
  | { ok: true; data: VesselDataBundle }
  | { ok: false; error: VesselDataError; partial?: Partial<VesselDataBundle> };
```

6. Support missing `vesselData.xml` as a non-fatal degraded mode, matching current behavior.
7. Add fixture tests for XML parsing and `.snt` grid parsing.

Exit criteria:

- Missing dat directory degrades gracefully.
- Valid fixtures produce expected factions, vessels, tubes, storage, beams, engines, descriptions, and grids.

### Phase 6: Bun Server MVP

Goal: run a new Bun server with typed APIs and legacy-equivalent state.

Tasks:

1. Implement `apps/server/src/index.ts` with `Bun.serve`.
2. Add typed config loading:
   - `tcpPort`, default `3000`
   - `artemisServerAddr`
   - `playerShipIndex`, default `0`
   - `headless`, default `false`
   - `datDir`, default `./dat`
3. Add CLI support:
   - `--headless`
   - `--server <addr>`
   - optional `--port <port>`
   - optional `--dat-dir <path>`
4. Implement HTTP API routes.
5. Implement WebSocket upgrade route, for example `/api/realtime`.
6. Implement local IP discovery in one shared helper.
7. Implement typed Artemis client wrapper using protocol package.
8. Implement station selection:
   - `shipSelect`
   - `setStation(0, true)`
   - `setStation(7, true)`
   - `setStation(9, true)`
   - `ready`
9. Implement model broadcasting on packet/domain event.
10. Add structured logging.

Exit criteria:

- Server starts with Bun.
- Server can connect to fake Artemis TCP server.
- `GET /api/model` returns a typed model.
- Browser WebSocket receives events.
- Command endpoints return structured success/failure responses.

### Phase 7: React Shell And Routing

Goal: replace EJS pages with React routes while keeping visual/function parity.

Tasks:

1. Create React app in `apps/web`.
2. Configure TanStack Router file-based routes.
3. Add root layout with connection overlay.
4. Add QueryClient and RouterProvider.
5. Add API client and query/mutation hooks.
6. Add WebSocket hook that:
   - fetches initial model through TanStack Query,
   - opens real-time WebSocket,
   - dispatches packet/model events into the client model store,
   - shows disconnected/reconnecting state.
7. Port global CSS and fonts into app-level CSS modules or plain CSS.
8. Bundle audio/font/image assets through the web build.

Exit criteria:

- `/` route can connect/disconnect against fake server.
- Route navigation works without full page reloads.
- Connection overlay behavior exists on all console routes.

### Phase 8: Port Consoles One At A Time

Goal: retire legacy browser scripts by route.

Recommended order:

1. Home route:
   - server address input
   - connect/disconnect mutation
   - local Glitter address display
   - ship selector
   - console links
2. Bearing table:
   - selector-driven rows
   - responsive fit behavior
   - color logic
3. Proximity monitor:
   - distance selectors
   - alarm toggles
   - status precedence
   - audio behavior
   - shield damage alert
4. Tubes matrix:
   - tube/stores selector
   - load/unload/fire mutations
   - pending auto-load behavior
   - loading/unloading gradient
5. Debug map:
   - decide whether to keep OpenLayers as a pinned npm dependency or replace with first-party canvas/SVG
   - entity selection/details panel
   - coordinate transform parity

Exit criteria per route:

- Visual screenshot matches current behavior closely enough.
- Route passes component tests.
- Route passes fake-Artemis E2E smoke flow.
- Legacy script for that route is no longer loaded.

### Phase 9: Remove Express/EJS/Socket.IO Legacy Path

Goal: complete runtime migration.

Tasks:

1. Remove Express routes and EJS views after React replacements are verified.
2. Remove Socket.IO if native WebSocket path is complete.
3. Remove `app.js`, `routes/index.js`, and legacy public scripts after parity is confirmed.
4. Keep static assets that the React app still uses.
5. Remove Grunt/node-webkit packaging unless a compatibility branch is needed.
6. Update README with Bun commands.

Exit criteria:

- `bun run dev` starts the new app.
- `bun run build` creates production artifacts.
- `bun test`, `bun run typecheck`, and lint pass.
- No legacy server path remains in production scripts.

### Phase 10: Distribution

Goal: replace legacy node-webkit release flow.

Tasks:

1. Build production web app.
2. Serve built app from Bun server.
3. Evaluate Bun full-stack executable:
   - imports React app HTML into server entrypoint,
   - uses `bun build --compile`,
   - embeds frontend assets,
   - includes needed static audio/font/image assets,
   - leaves external `dat/` configurable.
4. Add platform build scripts:
   - macOS arm64/x64
   - Windows x64
   - Linux x64
   - Linux arm64 if Raspberry Pi remains a goal
5. Document config file/env/CLI lookup order.

Exit criteria:

- A standalone built artifact can run the local server and serve the UI.
- External Artemis `dat` directory can be configured without rebuilding.
- Release artifacts include license and asset attribution.

## API Contract Sketch

### Read APIs

```ts
GET /api/status
Response: {
  connected: boolean;
  connectionState: ArtemisConnectionState;
  selectedServer: string | null;
  selectedShipIndex: number;
  version: ServerVersion | null;
}
```

```ts
GET /api/model
Response: WorldModelSnapshot
```

```ts
GET /api/glitter-addresses
Response: { addresses: string[] }
```

### Command APIs

```ts
POST /api/connect
Body: { server: string; retries?: number }
```

```ts
POST /api/ship-select
Body: { playerShipIndex: number }
```

```ts
POST /api/tubes/:tube/load
Body: { ordnance: 0 | 1 | 2 | 3 }
```

```ts
POST /api/tubes/:tube/unload
Body: {}
```

```ts
POST /api/tubes/:tube/fire
Body: {}
```

Validation rules:

- `server` must be a hostname or IP address, not an arbitrary URL.
- `playerShipIndex` must be an integer from `0` to `7`.
- `tube` route param must be an integer from `1` to `6`.
- `ordnance` must be an integer from `0` to `3`.
- Commands must fail gracefully when Artemis is not connected.

## Data And Event Types

### Protocol Payload Typing Strategy

Use discriminated packet names:

```ts
type PacketEvent =
  | { name: "playerUpdate"; payload: PlayerUpdate }
  | { name: "npcUpdate"; payload: NpcUpdate }
  | { name: "weaponsUpdate"; payload: WeaponsUpdate }
  | { name: "gameOverReason"; payload: GameOverReason }
  | { name: "unknown"; payload: UnknownPacket };
```

Use generated or hand-written maps:

```ts
type PacketPayloadByName = {
  playerUpdate: PlayerUpdate;
  weaponsUpdate: WeaponsUpdate;
  loadTube: LoadTubeCommand;
};
```

This lets the server emit packet events and commands without stringly typed payloads.

### Domain Event Strategy

Separate packet payloads from domain events. Packet payloads describe the wire protocol; domain events describe model changes:

```ts
type DomainEvent =
  | { type: "entityUpdated"; entityType: EntityType; data: EntityUpdate }
  | { type: "entityDestroyed"; id: EntityId }
  | { type: "ownShipUpdated"; id: EntityId }
  | { type: "gameOver" }
  | { type: "connectionChanged"; connected: boolean };
```

Packet-to-domain mapping belongs in `packages/domain` or a small `server` adapter, not in UI components.

## UI Component Plan

### Connection Overlay

Inputs:

- `connectionState`
- `serverIpAddr`
- `serverVersion`
- `selectedShipName`
- `gameStarted`
- `gameOverReason`
- `gameOverStats`

Behavior:

- Show disconnected message with link to `/`.
- Show connected/simulation-not-started message.
- Hide after simulation starts.
- Show game-over reason/stats when received.

### Bearing Table

Inputs:

- `WorldModel`
- viewport height/width

Selectors:

- `selectNearestVesselCandidates`
- `selectBearingRows(model, maxRows)`

Implementation notes:

- Avoid direct table row mutation.
- Preserve existing responsive dense table aesthetic.
- Use `ResizeObserver` to compute row capacity instead of mutating rows every 100 ms.

### Proximity Monitor

Inputs:

- `WorldModel`
- local alarm toggles

Selectors:

- `selectProximityDistances`
- `selectProximityStatus`
- `selectShieldStatus`

Implementation notes:

- Use text rendering, not HTML strings.
- Use a custom `useAudioAlert(status)` hook.
- Preserve status precedence unless deliberately changed after tests:
  - nebula
  - hazard
  - enemy
  - red alert
  - mine
  - drone
  - default ship name

### Tube Matrix

Inputs:

- `WorldModel.weapons`
- `vesselData[ownShipType]`
- pending auto-load local state

Selectors:

- `selectTubeRows`
- `selectStores`
- `selectTubeCellState`

Implementation notes:

- Use mutation hooks for commands.
- Disable buttons while command is in flight where appropriate.
- Keep pending auto-load logic explicit and testable.

### Debug Map

Options:

1. Keep OpenLayers as a pinned dependency.
2. Replace with a canvas/SVG tactical map component.

Recommendation:

- Replace if current needs are just entity dots, labels, selection, and coordinates.
- Keep OpenLayers only if zoom/pan/projection features are needed.

## Testing Strategy

### Unit Tests

Use `bun test` for:

- Buffer reader/writer.
- Packet decoder/encoder.
- Model reducer.
- Selectors.
- Config parsing.
- API schema validation.

Bun's test runner supports TypeScript/JSX, lifecycle hooks, snapshot testing, watch mode, and `bun:test` APIs. Use it as the default test runner unless a specific library requires Vitest.

### Type Tests

Use TypeScript checking separately:

- `bunx tsc -b --noEmit`
- Add type-level assertions only where packet maps or API contracts become complex.

### Component Tests

Options:

- React Testing Library with jsdom/happy-dom.
- Bun test runner if DOM support is sufficient for project needs.
- Vitest only if ecosystem friction becomes high.

Test cases:

- Home page connect form.
- Ship selector updates.
- Bearing rows render correct numeric formatting.
- Proximity status precedence.
- Tube matrix command selection.
- Connection overlay states.

### E2E Tests

Use a fake Artemis TCP server that emits packet sequences and records outgoing commands.

Flows:

1. Start app.
2. Connect to fake Artemis.
3. Receive welcome/version/ship settings/player update.
4. Navigate to each console.
5. Verify UI updates.
6. Trigger tube load/fire/unload.
7. Assert fake Artemis received expected encoded packets.
8. Simulate disconnect and reconnect.
9. Simulate game-over stats.

### Visual Regression

Capture screenshots for each console in:

- Desktop landscape.
- Tablet landscape.
- Phone portrait.

The current UI is intentionally dense and instrument-like; migration should not become a marketing dashboard.

## Risk Register

### Protocol Regression

Risk: TypeScript port changes byte-level parsing/encoding.

Mitigation:

- Fixtures before porting.
- Snapshot encoded command bytes.
- Decode current and new packet outputs side-by-side during transition.

### Runtime TCP Differences

Risk: Bun native TCP buffering/backpressure differs from Node `net`.

Mitigation:

- Start with Node-compatible `node:net` under Bun if it works.
- Move to `Bun.connect` only after protocol tests pass.
- Add split/concat packet tests.

### Real-Time Event Flooding

Risk: React rerenders too often under packet load.

Mitigation:

- Use store selectors.
- Batch model updates.
- Update high-frequency displays through selectors and memoization.
- Consider route-specific throttling.

### Behavior Hidden In Global DOM Scripts

Risk: Small current behaviors are missed during React port.

Mitigation:

- Port one route at a time.
- Capture DOM/screenshot baselines.
- Keep legacy and React routes side-by-side until each route passes smoke tests.

### Desktop Packaging Scope Creep

Risk: Replacing node-webkit distracts from app migration.

Mitigation:

- Treat packaging as Phase 10.
- First ship a Bun-served web app.
- Evaluate `bun build --compile` only after core behavior is stable.

## Suggested Milestone Order

1. `docs` and test fixture capture.
2. Bun workspace skeleton.
3. Protocol reader/writer.
4. Packet registry and core packets.
5. Domain model reducer/selectors.
6. Vessel data loader.
7. Bun server with fake Artemis.
8. React app shell and TanStack Router.
9. Home route.
10. Bearing route.
11. Proximity route.
12. Tubes route.
13. Debug map route.
14. Remove legacy Express/EJS/Socket.IO.
15. Bun executable/distribution work.

## Definition Of Done

The migration is complete when:

- `bun install --frozen-lockfile` succeeds from a clean checkout.
- `bun run dev` starts the app using Bun.
- `bun run build` creates production server and web artifacts.
- `bun test` passes unit and integration tests.
- TypeScript checking passes in all workspaces.
- React UI covers every current console.
- Fake Artemis E2E covers connect, ship select, model hydration, live updates, and tube commands.
- Manual test against a real Artemis server confirms protocol compatibility.
- No production path depends on Express 3, EJS, Socket.IO 1.x, Grunt, or node-webkit.
- README documents Bun-based development, configuration, and release commands.

## External References Checked

Checked on 2026-04-29:

- [Bun overview](https://bun.sh/docs): Bun is an all-in-one runtime/package manager/test runner/bundler for JavaScript and TypeScript.
- [Bun workspaces](https://bun.sh/docs/pm/workspaces) and [bun --filter](https://bun.sh/docs/pm/filter): `package.json` workspaces support local packages, de-duplicated installs, and filtered workspace scripts.
- [Bun HTTP server](https://bun.sh/docs/runtime/http/server): `Bun.serve` supports static/dynamic/per-method routes and HTML imports for full-stack apps.
- [Bun TCP](https://bun.sh/docs/runtime/networking/tcp): native `Bun.connect` and `Bun.listen` are available for TCP clients/servers.
- [Bun WebSockets](https://bun.sh/docs/runtime/http/websockets): `Bun.serve` supports server-side WebSockets and publish-subscribe.
- [Bun TypeScript](https://bun.sh/docs/typescript) and [Bun file loaders](https://bun.sh/docs/runtime/file-types): install `@types/bun`, use strict compiler options, and run TypeScript checking separately because Bun transpiles without typechecking.
- [Bun test runner](https://bun.sh/docs/test): `bun test` supports TypeScript/JSX, snapshots, lifecycle hooks, mocking, and watch mode.
- [Bun executables](https://bun.sh/docs/bundler/executables): `bun build --compile` can produce standalone executables and full-stack executables with frontend assets.
- [TanStack Router overview](https://tanstack.com/router/latest/docs/overview) and [file-based routing](https://tanstack.com/router/latest/docs/routing/file-based-routing): supports type-safe React routing, nested routes, search params, route loaders, and file-based route generation.
- [TanStack Query React docs](https://tanstack.com/query/v5/docs/framework/react): provides React server-state/data-fetching tools, query/mutation APIs, caching, polling/realtime examples, and ESLint rules.
- [TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview): currently documented as Release Candidate and powered by TanStack Router and Vite; useful to revisit later but not required for this migration.
