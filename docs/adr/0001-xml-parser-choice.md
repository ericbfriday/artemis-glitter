# ADR 0001: XML Parser Choice

Status: Accepted

## Context

The legacy `vesselData.js` uses `node-xml-lite` to parse `vesselData.xml`, which defines ship types, ordnance, and other game configuration. The migration to TypeScript/Bun requires a new parser with:

- TypeScript type definitions
- Active maintenance
- Small bundle size (will run in browser via `apps/web`)
- Correct handling of edge cases in `vesselData.xml`: BOM, attributes-only nodes, nested child collections

## Decision

Use `fast-xml-parser` (fxp) v4.x.

## Candidates Evaluated

### fast-xml-parser (SELECTED)

- TypeScript types built-in (no `@types/` needed)
- Actively maintained, 6k+ GitHub stars
- Zero dependencies
- ~40KB minified, suitable for browser
- Supports attribute prefix customization (needed for `vesselData.xml` attribute-heavy nodes)
- Handles BOM, CDATA, and namespace edge cases
- Bun-compatible with no Node-specific APIs

### tml

- Very small (~3KB)
- No TypeScript types
- Minimal maintenance activity
- No attribute parsing configuration

### htmlparser2

- SAX-style, requires building a tree manually
- Would need custom vesselData tree builder
- Well-maintained via `feed/parser` monorepo
- More code to write for equivalent functionality

### Hand-rolled

- Full control but high maintenance cost
- XML edge cases (entities, encoding, CDATA) are non-trivial
- No tangible benefit over `fast-xml-parser` for this use case

## Consequences

- `fast-xml-parser` added as dependency of `packages/domain`
- Attribute access pattern changes from `node.attr.name` to `node["@_name"]` (fxp default attribute prefix)
- BOM handling is automatic — no special logic needed
- Bundle size impact is acceptable for the web app (40KB gzip ~12KB)
