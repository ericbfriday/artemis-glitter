# Test Baselines — DOM Spec & Interaction Documentation

## Why DOM-Spec Based (Not Screenshot-Based)

This directory contains **DOM-shape specifications and interaction documentation** derived from static analysis of the legacy EJS templates and JavaScript controllers, rather than actual browser screenshots or rendered DOM snapshots.

**Reason:** The legacy `artemis-glitter` repository has no lockfile and its `package.json` pins dependencies to `"latest"` or `">="` ranges. Attempting `npm install` is unreliable — dependency resolution may fail or pull incompatible versions. The legacy app cannot be reliably started in CI or locally without significant environment archaeology. This is the documented fallback approach specified in task card **P0-T4**.

**What these specs capture:**
- The exact DOM structure each EJS template produces (element hierarchy, IDs, classes)
- All JavaScript-driven DOM mutations (innerHTML writes, class toggles, style changes)
- Socket.IO event subscriptions and their DOM effects
- XHR endpoints the client calls
- Timer-based update loops and their intervals
- Known legacy bugs that should become regression test cases

## How to Replace with Real Screenshots

Once the legacy app can be reliably started (e.g., via a Docker image with pinned deps, or after the React migration is complete), a future agent should:

1. **Start the legacy app** in a CI-compatible environment
2. **Use Playwright or similar** to navigate to each of the 5 routes
3. **Capture full-page screenshots** at each route (default state)
4. **Capture interaction-state screenshots** for active consoles (e.g., connected state, red alert state, tubes loaded state)
5. **Generate DOM snapshots** (`page.content()` or accessibility tree dumps) for structural comparison
6. **Store screenshots** as `test/baselines/<route>.screenshot.png` alongside the existing `.dom.md` files
7. **Update this README** to index the new screenshot files

The `.dom.md` specs should be retained even after screenshots are available — they serve as human-readable contracts for what the React port must implement.

## File Index

### DOM Shape Specs (5 files)

| File | Route | EJS Source | Primary JS Controller |
|------|-------|------------|----------------------|
| [`index.dom.md`](./index.dom.md) | `/` | `views/index.ejs` | `public/javascripts/serverstatus.js` |
| [`bearing-table.dom.md`](./bearing-table.dom.md) | `/bearing-table` | `views/bearing-table.ejs` | `public/javascripts/bearing-table.js` |
| [`proximity.dom.md`](./proximity.dom.md) | `/proximity` | `views/proximity.ejs` | `public/javascripts/proximity.js` |
| [`tubes.dom.md`](./tubes.dom.md) | `/tubes` | `views/tubes.ejs` | `public/javascripts/tubes.js` |
| [`map.dom.md`](./map.dom.md) | `/map` | `views/map.ejs` | `public/javascripts/map.js` |

### Interaction Specs (4 files — active consoles only)

| File | Route | Click Targets | Socket.IO Events | XHR Endpoints |
|------|-------|---------------|-------------------|---------------|
| [`index.interactions.md`](./index.interactions.md) | `/` | 3 (connect, disconnect, ship select) | 4 | 5 |
| [`bearing-table.interactions.md`](./bearing-table.interactions.md) | `/bearing-table` | 0 (read-only display) | 11 | 1 |
| [`proximity.interactions.md`](./proximity.interactions.md) | `/proximity` | 6 (alarm togglers) | 14 | 1 |
| [`tubes.interactions.md`](./tubes.interactions.md) | `/tubes` | 24 (tube/ordnance cells) | 12 | 4 endpoint patterns |

> **Note:** `/map` has no interactions file — it is a read-only debug display with only a map click handler (selecting entities for inspection), which is documented in `map.dom.md`.

### Summary of Known Legacy Bugs

These bugs were discovered during static analysis and should serve as regression test cases:

| Bug | File:Line | Route | Severity |
|-----|-----------|-------|----------|
| `publicIPs[0]` used instead of `publicIPs[i]` in for-loop | `serverstatus.js:85` | `/` | Medium — multi-NIC displays show wrong IPs |
| `ownAddress` vs `ownaddress` casing mismatch | `serverstatus.js:72,75,87` | `/` | High — multi-IP help text never renders |
| String assigned to element ref instead of `.innerHTML` | `serverstatus.js:87` | `/` | High — multi-IP branch silently broken |
| `class="margin:3em;"` is not valid CSS class | `index.ejs:10` | `/` | Low — cosmetic, no effect |
| `checkingProximity` early-return leaves mutex locked | `proximity.js:43-45` | `/proximity` | High — can permanently freeze proximity checks |
| Orphan `</table>` closing tag | `proximity.ejs:31` | `/proximity` | Low — invalid HTML, ignored by browsers |
| `minDistances[5]` (station) never initialized, never displayed | `proximity.js:120` | `/proximity` | Low — dead code, calls `distanceToKs(undefined)` |
| Missing `#audio-nebula` and `#audio-hazard` elements | `proximity.ejs:32-34` | `/proximity` | Medium — no audio for nebula/hazard alerts |
| `insideNebula` flag declared but never updated | `proximity.js:6,90-95` | `/proximity` | Medium — nebula enter/exit tracking broken |
| Global `i` variable in toggler loop | `proximity.js:231` | `/proximity` | Low — implicit global |
| `model.on('ownShipInit', initTubes, 1000)` third arg | `tubes.js:201` | `/tubes` | Medium — likely ignored, leftover from setTimeout refactor |
| Re-declaration of `var oReq` in `tubeAction()` | `tubes.js:179` | `/tubes` | Low — harmless due to hoisting |
| External OL3 CDN over HTTP, unpinned version | `map.ejs:2,26` | `/map` | High — CDN may be unavailable, insecure |
| `popup` overlay created but never used | `map.js:122-124` | `/map` | Low — dead code |
| `white-space: no-break` invalid CSS value | `map.js:255` | `/map` | Low — should be `nowrap` |
| Global `key` variable in `showData()` | `map.js:249` | `/map` | Low — implicit global |
