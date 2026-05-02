# Current Architecture And Code Review

## Executive Summary

`artemis-glitter` is a legacy Node.js web application that connects to an Artemis Space Bridge Simulator server over raw TCP, parses Artemis protocol packets, maintains an in-memory world model, and exposes auxiliary browser consoles over Express, EJS, static JavaScript, and Socket.IO.

The codebase is compact, roughly 5.5K lines of non-vendored source excluding fonts and audio assets, but the major responsibilities are tightly coupled. The same `worldmodel.js` file runs in both Node and browser contexts, server routes issue state-changing commands through GET endpoints, and packet parsing, socket lifecycle, logging, reconnection, and event dispatch live in a single `artemisNet.js` module. There is no lockfile, no tests, and dependencies are unpinned or legacy-era packages.

The migration should preserve the protocol implementation and UI behavior first, then split the code into typed packages with explicit protocol, domain, server, client transport, and React UI boundaries.

## Current Runtime Shape

### Server Process

The server starts from `app.js`. It:

- Detects a config directory for node-webkit/source execution.
- Loads `config/default.yaml` through the `config` package.
- Creates an Express 3 app with EJS views and static assets.
- Creates an HTTP server and attaches Socket.IO.
- Starts listening on `config.tcpPort`.
- Optionally connects to an Artemis server and opens the default browser.

Important entry points:

- `GET /`: server/ship selection page.
- `GET /model`: returns the full serialized world model.
- `GET /map`, `/bearing-table`, `/proximity`, `/tubes`: EJS-rendered console pages.
- `GET /connect/:server`, `/disconnect`, `/ship-select/:playerShipIndex`: mutate connection and ship state.
- `GET /unload-tube/:tube`, `/fire-tube/:tube`, `/load-tube/:tube/:ordnance`: send weapon/tube commands to the Artemis server.
- Socket.IO broadcasts every parsed Artemis packet to browser clients by packet name.

### Artemis TCP Protocol Layer

`artemisNet.js` owns the TCP socket to Artemis port `2010`, retry behavior, packet framing, packet registration, packet unpacking, packet packing, and a custom event-handler registry.

Protocol flow:

1. `net.connect` opens a TCP socket.
2. Incoming `data` buffers are concatenated with `previousBuffer` if a packet is incomplete.
3. The fixed 24-byte packet header is parsed.
4. Known packet definitions are looked up by packet type and subtype.
5. Packet definitions in `packets/**` unpack payloads using `artemisBufferReader`.
6. Events fire both under the concrete packet name and under the aggregate `packet` event.
7. `app.js` relays aggregate packet events to Socket.IO clients.

The packet registry is dynamic: `recursiveRegisterPacket(__dirname + '/packets')` traverses every file and calls `registerPacketType(require(fullname))`.

### Packet Definitions

The `packets/` tree contains 50 packet definition modules. They use a uniform CommonJS shape:

- `exports.name`
- `exports.type`
- `exports.subtype`
- `exports.subtypeLength`
- `exports.pack`
- `exports.unpack`

Incoming object-update packets use bit masks to conditionally parse fields. Outgoing action packets write command buffers through `artemisBufferReader` write methods.

This is one of the most valuable parts of the application and should be migrated carefully with characterization tests before behavioral refactors.

### World Model

`public/javascripts/worldmodel.js` is the domain core, but it is also a transport adapter and module-format bridge.

In Node:

- It `require`s `../../artemisNet`.
- It loads `vesselData`.
- It registers packet event handlers directly on `artemisNet`.
- It exports `model` and `returnModelAsJSON`.
- It discovers local IP addresses and can broadcast a Glitter address through an Artemis game-master message.

In the browser:

- It creates a Socket.IO client with `io.connect()`.
- It fetches `./model` to hydrate initial state.
- It listens for packet events over Socket.IO.
- It performs client-side extrapolation of stale moving entity positions.

The state is a mutable singleton with nested objects for entities, comms, incoming audio, intel, engineering/weapons station state, ship settings, damcon, skybox, difficulty, server IPs, and vessel/faction data.

### Browser UI

The UI is server-rendered EJS plus global static scripts. It does not use a module system, bundler, or component framework.

Current screens:

- `views/index.ejs` + `serverstatus.js`: connect/disconnect, display local server address, select ship, navigate to console pages.
- `views/bearing-table.ejs` + `bearing-table.js`: table of nearby vessels with bearing, distance, and heading.
- `views/proximity.ejs` + `proximity.js`: proximity monitor, status text, alarm toggles, and audio alerts.
- `views/tubes.ejs` + `tubes.js`: torpedo storage/tube status grid and load/fire/unload actions.
- `views/map.ejs` + `map.js`: debug map using OpenLayers loaded from `http://ol3js.org/en/master`.

Shared UI scripts:

- `angles.js`: bearing/distance calculations.
- `prettyprint.js`: distance/color formatting.
- `redalert.js`: toggles body class on red-alert updates.
- `connectionlost.js`: common overlay for connection/game status and game-over stats.

### Packaging

The legacy package target is node-webkit. `server-page.html` loads `require('./app')`, and `Gruntfile.js` uses `grunt-node-webkit-builder`, `grunt-zip`, and `grunt-contrib-copy` to build platform archives.

The package manifest is pre-modern:

- `main` points at `server-page.html`.
- `express` is `3.x`.
- `socket.io` is `>= 1.0.6`.
- Several dependencies use broad ranges such as `latest` or `>=`.
- There is no lockfile.
- There are no `scripts` for start, test, lint, or build.

## Architectural Strengths

- The domain is small enough to migrate incrementally.
- Packet definitions already have a regular shape that can become a typed packet registry.
- The world model centralizes most derived game state, making behavior discoverable.
- Browser consoles are already separate pages, which map naturally to future TanStack routes.
- Static assets are local except OpenLayers, so UI bundling can preserve most visual behavior.
- The app mostly uses plain Node APIs and buffers, which Bun can support or replace with native APIs.

## High-Impact Findings

### P1: State-Changing GET Routes Have No Validation Or Authorization

References: `app.js:147`, `app.js:190`, `app.js:197`, `app.js:202`, `app.js:207`

The server exposes actions like connect, ship selection, unload, fire, and load over GET endpoints. Parameters are passed directly into connection or packet-emission logic with minimal coercion. Any browser or device on the LAN that can reach the Glitter HTTP server can trigger gameplay actions by loading URLs. This is especially risky for `/fire-tube/:tube`.

Migration recommendation:

- Convert command endpoints to `POST /api/...`.
- Validate request bodies with a schema library.
- Restrict numeric ranges for ship index, station ID, tube, and ordnance.
- Add a local-session or LAN pairing token for command-capable clients.
- Keep read-only endpoints separate from command endpoints.

### P1: Socket.IO Listener Registration Leaks Per Browser Connection

Reference: `app.js:99`

Each new browser socket registers a new `artemisNet.on('packet', ...)` handler. There is no corresponding removal on browser disconnect. Over time, reconnects or multiple clients will accumulate handlers and continue closing over dead socket instances. This can duplicate work, grow memory, and cause stale emits.

Migration recommendation:

- Put a single Artemis packet listener at process startup.
- Have that listener publish to a managed WebSocket topic or client registry.
- Track connected clients centrally and clean up on close.

### P1: Binary Parser Can Stall Or Misparse On Unknown Subpackets

References: `artemisNet.js:150`, `artemisNet.js:166`, `artemisNet.js:171`, `artemisNet.js:181`

When a subtype is present but not found, `packetDef` can retain a previous definition or remain falsy, then `packetDef.unpack(data)` is attempted inside a try/catch. Unknown packet handling logs and breaks, but the parser has weak guarantees that the read pointer advances correctly. This can cause packet loss for multi-subpacket frames and makes parser failures hard to recover.

Migration recommendation:

- Create a typed `PacketDecoder` with explicit result types: `ok`, `incomplete`, `unknown`, `malformed`.
- Never reuse a previous packet definition after an unknown subtype.
- Make pointer advancement explicit and tested for every decoder.
- Preserve unknown payload bytes in diagnostics without crashing or corrupting following packets.

### P1: Vessel `.snt` Loading References An Undefined Variable

Reference: `vesselData.js:90`

`readSnt(filename)` uses `fs.readFileSync(dir + '/' + filename)`, but `dir` is not defined in the module. If a vessel has `internal_data`, this code path should throw and return empty vessel/faction exports. That likely prevents torpedo tube maximums and internal ship grids from loading correctly from `*.snt` files.

Migration recommendation:

- Fix the current implementation or preserve the bug intentionally only if tests reveal downstream behavior depends on missing grids.
- Replace side-effect exports with an explicit `loadVesselData(datDir): Result<VesselData>` API.
- Add fixture tests for `vesselData.xml` and at least one `.snt` file.

### P1: Protocol Packets Are Written To An Unchecked Socket

References: `artemisNet.js:298`, `artemisNet.js:331`

`emit(packetName, data)` returns false for unknown packet names or unpackable packets, but otherwise calls `sock.write(...)` without confirming a socket exists, is connected, or can accept writes. UI command routes can call this during disconnected or reconnecting states and crash the process.

Migration recommendation:

- Introduce an Artemis client state machine: `idle`, `connecting`, `connected`, `disconnecting`, `retrying`, `failed`.
- Make command sending return a typed success/failure result.
- Surface command errors to the UI instead of using fire-and-forget XHR calls.

### P2: The World Model Is A Mutable Singleton Coupled To Transport And Rendering

References: `public/javascripts/worldmodel.js:8`, `public/javascripts/worldmodel.js:89`, `public/javascripts/worldmodel.js:399`, `public/javascripts/worldmodel.js:491`

The same file detects whether it is in Node or the browser and then wires itself to either `artemisNet` or Socket.IO. This prevents isolated unit testing, makes bundling fragile, and couples state mutation to the transport layer.

Migration recommendation:

- Extract pure model update reducers into `packages/domain`.
- Let server and browser adapters subscribe to event streams and dispatch typed events into the model.
- Use React state/store hooks for view-specific selection, not direct mutation of a global `model`.

### P2: Legacy Dependencies And Broad Version Ranges Make Builds Non-Reproducible

Reference: `package.json:11`

The manifest depends on legacy packages and broad ranges such as `latest`, `>=`, and `3.x`. There is no lockfile. Reinstalling today could produce a dependency graph that differs from any known working release, and some packages may no longer install or run cleanly on current Node.

Migration recommendation:

- Do not begin by updating in place.
- Create a new Bun workspace with pinned dependencies and `bun.lock`.
- Port behavior into typed packages behind tests.

### P2: Browser HTML Injection Uses `innerHTML` With Protocol-Derived Data

References: `public/javascripts/map.js:259`, `public/javascripts/proximity.js:166`, `public/javascripts/serverstatus.js:111`, `public/javascripts/connectionlost.js:64`, `public/javascripts/connectionlost.js:65`, `public/javascripts/connectionlost.js:78`, `public/javascripts/bearing-table.js:184`

Several UI paths construct HTML with values from Artemis packets, ship names, messages, or stats. In the current use case the Artemis server is probably trusted LAN software, but this still creates injection risk and makes rendering correctness fragile.

Migration recommendation:

- React-render all dynamic text as text nodes.
- If rich HTML is truly needed, define sanitized structured payloads rather than passing arbitrary strings.

### P2: Runtime State And Configuration Are Mutated In Process Globals

References: `app.js:148`, `app.js:191`, `app.js:214`

The app mutates the imported `config` object for selected server, selected ship, and `headless` state. CLI parsing is manual. Runtime state is not persisted except via the legacy `config` package runtime behavior, and there is no clear boundary between static config, runtime preferences, and live connection state.

Migration recommendation:

- Use a typed runtime config module that reads environment, CLI arguments, and config files once.
- Store mutable preferences separately from live connection/session state.
- Provide an explicit API for changing preferred Artemis server and selected ship.

### P2: Client Polling And High-Frequency UI Work Are Ad Hoc

References: `public/javascripts/proximity.js:177`, `public/javascripts/bearing-table.js:189`, `public/javascripts/worldmodel.js:463`

The proximity monitor and bearing table update every 100 ms regardless of packet activity. The world model also performs extrapolation on an interval. This is acceptable for a small app, but it makes rendering workload unpredictable and hard to test.

Migration recommendation:

- Move expensive calculations into memoized selectors.
- Drive React updates from model events and `requestAnimationFrame` where display refresh is needed.
- Rate-limit or sample derived UI updates by route.

### P2: External HTTP Assets In The Debug Map Are Fragile

Reference: `views/map.ejs:2`, `views/map.ejs:26`

The debug map loads OpenLayers from `http://ol3js.org/en/master`, which is insecure, mutable, and may be unavailable. It also prevents offline operation for that screen.

Migration recommendation:

- Use a pinned npm dependency or replace the map with a first-party canvas/SVG component if only a simple tactical map is needed.
- Bundle all UI assets.

### P3: Event Handler Removal Leaves Sparse Arrays

References: `artemisNet.js:85`, `public/javascripts/worldmodel.js:59`

`off` deletes array entries instead of splicing them or using a `Set`. Iteration by `for...in` skips holes in many cases, but the arrays never compact and the pattern is easy to misuse.

Migration recommendation:

- Replace custom event registries with `EventTarget`, a small typed emitter using `Set`, or a stream abstraction.

### P3: Packet Parser Debugging And Production Logging Are Mixed

Reference: `artemisNet.js:186`

The parser logs many packets and malformed payload bytes directly to console. This is useful during protocol reverse engineering, but not a controlled operational logging strategy.

Migration recommendation:

- Add structured logging levels.
- Keep packet tracing behind a runtime flag.
- Add packet fixtures for regression tests instead of depending on console traces.

### P3: Minor UI Bugs In Existing Code

References: `public/javascripts/serverstatus.js:72`, `public/javascripts/serverstatus.js:75`, `public/javascripts/serverstatus.js:85`, `public/javascripts/serverstatus.js:87`, `public/javascripts/proximity.js:43`

Examples:

- `ownAddress` is declared but `ownaddress` is used, relying on the global DOM ID binding.
- The multiple-IP loop repeatedly renders `publicIPs[0]` instead of `publicIPs[i]`.
- The generated multiple-IP string is assigned to `ownaddress`, not `ownaddress.innerHTML`.
- `checkProximity` can return while `checkingProximity` remains true if the player ship is missing.

Migration recommendation:

- Capture these as regression tests before replacing the UI.
- Fix only if behavior is clearly incorrect and covered.

## Test Coverage And Verification Gaps

There are no automated tests and no test scripts. A syntax check with Node 20 passed for all JavaScript files, but that does not validate runtime compatibility, dependency installation, packet behavior, UI behavior, or Artemis interoperability.

Highest priority test coverage before migration:

1. Packet framing tests for complete, split, concatenated, malformed, and unknown packets.
2. Packet decoder/encoder tests for representative incoming and outgoing packet definitions.
3. World-model reducer tests for entity create/update/delete, own-ship detection, game-over reset, ship settings, weapons, engineering, comms, damcon, and pause behavior.
4. Derived selector tests for nearest contacts, proximity status, bearing/distance formatting, tube button state, and red-alert state.
5. Minimal UI route tests for connect page, bearing table, proximity monitor, tubes matrix, and connection-lost overlay.
6. End-to-end smoke tests with recorded packet fixtures or a fake Artemis TCP server.

## Behavior To Preserve

The migration should preserve these user-facing capabilities:

- Start a local Glitter server, defaulting to port `3000`.
- Connect/disconnect to an Artemis server on TCP port `2010`.
- Select player ship index.
- Request the same station set on welcome: main screen, observer, game master, then ready.
- Relay parsed Artemis packets to connected browsers.
- Hydrate clients with the current world model on load.
- Maintain entities, comms, intel, incoming audio, ship settings, engineering, weapons, damcon, skybox, difficulty, game started/paused state, server version, and vessel/faction data.
- Show connection/game-over overlay across consoles.
- Show bearing-distance table of nearby vessels.
- Show proximity monitor with shield/nebula/hazard/hostile/mine/drone status and audio alerts.
- Show torpedo tube stores/status and issue load/unload/fire commands.
- Preserve or replace the debug map with equivalent world-model inspection.
- Broadcast Glitter address into Artemis game-master/comms once the simulation starts.
- Support `--headless` and `--server <addr>` or equivalent Bun CLI flags.

## Migration Constraints

- The Artemis protocol layer is the riskiest code and should be migrated behind characterization tests before deep refactors.
- The UI is highly visual and real-time; React migration should preserve screens one route at a time.
- `worldmodel.js` is currently both a Node module and browser script; extracting pure domain logic is the key unlock for testing and React integration.
- Node-webkit packaging should not dictate the new architecture. Bun standalone executables or a separate desktop shell decision can happen after the web/server architecture is clean.
