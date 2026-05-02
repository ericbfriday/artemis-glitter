# Interactions Baseline: Bearing Table

| Field | Value |
|-------|-------|
| **Route** | `/bearing-table` |
| **JS Controllers** | `public/javascripts/bearing-table.js`, `public/javascripts/redalert.js`, `public/javascripts/connectionlost.js` |
| **Shared JS** | `public/javascripts/worldmodel.js`, `public/javascripts/angles.js`, `public/javascripts/prettyprint.js` |

## Click Targets

| Target | Selector | Action | Source |
|--------|----------|--------|--------|
| (none) | — | The bearing table has no interactive click elements. It is a read-only auto-updating display. | — |

> Note: The bearing table is entirely passive. Rows are added, updated, and removed automatically by the 100ms interval timer. There are no user-clickable elements.

## Keyboard Interactions

None. No keyboard event listeners are registered.

## XHR/Fetch Requests

### From `connectionlost.js` (page load)

| URL Pattern | Method | Payload | Trigger | Response Handling | Source |
|-------------|--------|---------|---------|-------------------|--------|
| `GET ./artemis-server` | GET | None | Page load (auto) | `receiveArtemisServerAddr()`: if non-empty, sets `model.connected = true` and `serverIpAddr`, then calls `checkConnected()` to populate `#connected` overlay | `connectionlost.js:106-109` |

## Socket.IO Events

### From `bearing-table.js`

No direct Socket.IO subscriptions. The bearing table reads from `model.entities` (populated by `worldmodel.js`) on each 100ms timer tick.

### From `redalert.js`

| Event Name | Direction | Handler | DOM Update | Source |
|------------|-----------|---------|------------|--------|
| `playerUpdate` | server → client | `iface.on('playerUpdate', ...)` | If `data.id == model.playerShipID` and `data.redAlert` is truthy: sets `document.body.className = 'red-alert'`; if falsy: sets `document.body.className = ''` | `redalert.js:4-16` |

### From `connectionlost.js`

| Event Name | Direction | Handler | DOM Update | Source |
|------------|-----------|---------|------------|--------|
| `connected` | server → client | `iface.on('connected', checkConnected)` | Updates `#connected` div with server info, vessel name, version | `connectionlost.js:81` |
| `disconnected` | server → client | `iface.on('disconnected', checkConnected)` | Shows "not connected" message with link back to `/` | `connectionlost.js:82` |
| `allShipSettings` | server → client | `iface.on('allShipSettings', checkConnected)` | Refreshes connected overlay with ship name | `connectionlost.js:83` |
| `consoleStatus` | server → client | `iface.on('consoleStatus', checkConnected)` | Refreshes connected overlay | `connectionlost.js:84` |
| `version` | server → client | `iface.on('version', checkConnected)` | Refreshes connected overlay with version string | `connectionlost.js:85` |
| `skybox` | server → client | `iface.on('skybox', checkConnected)` + `iface.on('skybox', hideConnectedOverlay)` | Refreshes overlay then hides it | `connectionlost.js:86-87` |
| `gameStart` | server → client | `iface.on('gameStart', checkConnected)` + `iface.on('gameStart', hideConnectedOverlay)` | Refreshes overlay then hides it | `connectionlost.js:88-89` |
| `gameOverReason` | server → client | `iface.on('gameOverReason', onGameOverReason)` | Shows game-over screen with title + reason in `#connected` div | `connectionlost.js:90` |
| `gameOverStats` | server → client | `iface.on('gameOverStats', showStatistics)` | Appends stats rows to `#gameOverStats` table inside `#connected` | `connectionlost.js:91` |
| `gameOver` | server → client | `iface.on('gameOver', checkConnected)` | Refreshes connected overlay | `connectionlost.js:92` |

### Model Events

| Event Name | Handler | DOM Update | Source |
|------------|---------|------------|--------|
| `glitterDisconnect` | `model.on('glitterDisconnect', onGlitterDisconnect)` | Shows "Connection to Glitter aborted" message in `#connected` | `connectionlost.js:94` |

## Data Flow Summary

The bearing table operates on a **polling model**, not event-driven updates:

1. `worldmodel.js` receives Socket.IO events and updates `model.entities`
2. Every 100ms, `updateTable()` reads `model.entities` directly
3. `updateTable()` manages rows: adds nearest entities, removes destroyed ones, swaps if closer entity found
4. `updateRow()` computes BRG/DST/HDG using `posToBrgDst()` from `angles.js` and formats with `radianToDegrees()` / `distanceToKs()` from `prettyprint.js`
