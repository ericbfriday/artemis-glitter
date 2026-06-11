# Repository Guidelines

## Project Structure & Module Organization
This repository is a Bun workspace with two apps and shared packages. Use `apps/server/src` for the Bun HTTP/WebSocket server and Artemis TCP client, and `apps/web/src` for the React/Vite frontend. Shared logic lives in `packages/protocol`, `packages/domain`, `packages/shared`, and `packages/config`, each with source under `src/`. Tests are mostly colocated as `*.test.ts` beside implementation files, while integration fixtures and baselines live under `test/` (`test/fake-artemis`, `test/fixtures`, `test/baselines`). Static browser assets and fonts are in `public/`.

## Build, Test, and Development Commands
Install dependencies with `bun install`. Start local development with `bun run dev`, which runs the server workspace and serves the app on `http://localhost:3000`. Build everything with `bun run build`. Run the full test suite with `bun test`, type-check with `bun run typecheck`, lint with `bun run lint`, and verify formatting with `bun run format`.

## Coding Style & Naming Conventions
TypeScript is the default across apps and packages. Follow the existing formatter rules: 2-space indentation, semicolons, double quotes, trailing commas, and 100-character line width. ESLint uses `typescript-eslint` plus `react-hooks`; fix warnings before opening a PR. Use `PascalCase` for React components, `camelCase` for functions/variables, and keep shared package exports centralized in `src/index.ts`. Do not hand-edit generated build outputs in `dist/` or the router artifact `apps/web/src/routeTree.gen.ts`.

## Testing Guidelines
Add unit tests beside the code they cover using the `*.test.ts` pattern already used in `packages/*/src`. Prefer fixture-driven tests for protocol decoding and domain parsing, reusing files in `test/fixtures/packets` and `test/fixtures/vesselData`. Use `bun test` before submitting changes, and extend the fake Artemis server tests in `test/fake-artemis` for end-to-end behavior that crosses the TCP/server boundary.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects such as `remove serena - plan still not implemented.` or `Migrate to TypeScript/Bun/React stack`. Keep subjects concise, describe observable behavior in the body when needed, and avoid mixing refactors with feature work. PRs should explain scope, list verification commands run, link related issues, and include screenshots or short recordings for UI changes.
