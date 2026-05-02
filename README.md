# artemis-glitter

A TypeScript/Bun web front-end for the [Artemis Spaceship Bridge Simulator](http://www.artemis.eochu.com/).

Connects to an Artemis server over TCP, decodes the binary protocol, maintains a live world model, and serves real-time console UIs to any browser on your network.

Supports Artemis 2.1.1.

Protocol reference: [Artemis Packet Protocol](https://github.com/rjwut/ArtClientLib/wiki/Artemis-Packet-Protocol) by @rjwut.

## Quick Start

```bash
bun install
bun run dev
```

Open `http://localhost:3000` in a browser. Use the home page to connect to an Artemis server.

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--server <addr>` | none | Artemis server address (host:port) |
| `--port <port>` | 3000 | HTTP server port |
| `--ship-index <n>` | 0 | Player ship index (0–7) |
| `--dat-dir <path>` | none | Path to Artemis `dat` directory |
| `--headless` | false | Run without opening browser |
| `--help` | | Show help |

Environment variables (`GLITTER_SERVER`, `GLITTER_PORT`, `GLITTER_DAT_DIR`, `GLITTER_SHIP_INDEX`, `GLITTER_HEADLESS`) are also supported.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server (HMR via Vite) |
| `bun run build` | Build all packages |
| `bun test` | Run tests |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint |
| `bun run format` | Prettier check |

## Project Structure

```
apps/
  server/     Bun.serve HTTP+WebSocket server, Artemis TCP client
  web/        React + TanStack Router/Query SPA

packages/
  protocol/   Binary wire format (BufferReader/Writer, packet registry, frame decoder)
  domain/     WorldModel, domain events, reducer, selectors, vessel/SNT data
  shared/     Zod API schemas, ApiResult<T>
  config/     Typed config with CLI/env/defaults merge

test/
  fixtures/   Binary packet fixtures (.bin + .json shadows)
  fake-artemis/   Fake Artemis TCP server for integration tests
  tools/      Fixture capture script
```

## Consoles

- **Home** — Server connection, ship selection, console links
- **Bearing Table** — BRG/DST/HDG of nearest vessels and stations
- **Proximity Monitor** — Distances to nearest asteroid/enemy/nebula/mine
- **Torpedo Tube Matrix** — Tube status, load/unload/fire controls
- **Debug Map** — Canvas-rendered entity positions with selection

## Tech Stack

- **Runtime**: Bun ≥1.1
- **Language**: TypeScript (strict, noUncheckedIndexedAccess)
- **Server**: Bun.serve with WebSocket support
- **Frontend**: React 19, TanStack Router (file-based), TanStack Query
- **Validation**: Zod
- **Build**: Vite (web), Bun bundler (server)
- **Testing**: Bun test runner






