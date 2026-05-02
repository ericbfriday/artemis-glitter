# Artemis Glitter Documentation

This directory captures a review of the current codebase and a migration plan toward a modern TypeScript stack using Bun for runtime/package management and React with TanStack for the UI.

## Documents

- [Current Architecture and Code Review](./current-architecture-and-review.md) records the existing application structure, runtime flow, coupling points, risks, and test observations.
- [TypeScript Bun React Migration Plan](./typescript-bun-react-migration-plan.md) proposes a phased migration that preserves behavior while introducing Bun, TypeScript, React, and TanStack Router/Query.

## Scope Of Analysis

Reviewed source areas:

- Server entry point and HTTP/socket routes: `app.js`, `routes/index.js`
- Artemis TCP client, packet registration, and binary parser: `artemisNet.js`, `artemisBufferReader.js`, `packets/**`
- Shared mutable world model: `public/javascripts/worldmodel.js`
- Browser consoles and presentation code: `views/**`, `public/javascripts/**`, `public/stylesheets/**`
- Artemis data loader and config: `vesselData.js`, `config/default.yaml`
- Legacy packaging: `package.json`, `Gruntfile.js`, `server-page.html`

Sanity checks run during review:

- `node --check` against every tracked JavaScript file outside `.git` and `node_modules`: passed.
- `node --version`: `v20.19.6`
- `npm --version`: `10.8.2`
- `node_modules`: absent, so dependency install/runtime behavior was not validated.

External references used for migration planning, checked on 2026-04-29:

- Bun docs: [overview](https://bun.sh/docs), [workspaces](https://bun.sh/docs/pm/workspaces), [TypeScript](https://bun.sh/docs/typescript), [file loaders](https://bun.sh/docs/runtime/file-types), [HTTP server](https://bun.sh/docs/runtime/http/server), [TCP](https://bun.sh/docs/runtime/networking/tcp), [WebSockets](https://bun.sh/docs/runtime/http/websockets), [test runner](https://bun.sh/docs/test), and [single-file executables](https://bun.sh/docs/bundler/executables).
- TanStack docs: [Router overview](https://tanstack.com/router/latest/docs/overview), [Router file-based routing](https://tanstack.com/router/latest/docs/routing/file-based-routing), [Query React docs](https://tanstack.com/query/v5/docs/framework/react), and [TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview).
