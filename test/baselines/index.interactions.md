# Interactions Baseline: Index (Welcome Page)

| Field | Value |
|-------|-------|
| **Route** | `/` |
| **JS Controllers** | `public/javascripts/serverstatus.js` |
| **Shared JS** | `public/javascripts/worldmodel.js` |

## Click Targets

| Target | Selector | Action | Source |
|--------|----------|--------|--------|
| Connect button | `#connect` | Sends XHR GET `./connect/{serveraddr}`. Hides `#connect`, shows `#connecting`, hides `#disconnect`, disables `#serveraddr` input. | `serverstatus.js:5-15` |
| Disconnect button | `#disconnect` | Sends XHR GET `./disconnect/`. Shows `#connect`, hides `#connecting` + `#disconnect`, enables `#serveraddr`, hides `#vessel-select`. | `serverstatus.js:17-27` |
| Ship selector | `#playershipname` (change event) | Reads selected value (ship index), sends XHR GET `./ship-select/{index}`. | `serverstatus.js:126-132` |
| Console links | `a[href="bearing-table"]`, `a[href="proximity"]`, `a[href="tubes"]` | Standard navigation — no JS handler, just `<a>` links. | `index.ejs:35-37` |

## Keyboard Interactions

None. No keyboard event listeners are registered.

## XHR/Fetch Requests

| URL Pattern | Method | Payload | Trigger | Response Handling | Source |
|-------------|--------|---------|---------|-------------------|--------|
| `GET ./connect/{serveraddr}` | GET | None (server addr in URL path) | Click `#connect` | Fire-and-forget (no `onload` handler) | `serverstatus.js:7-9` |
| `GET ./disconnect/` | GET | None | Click `#disconnect` | Fire-and-forget | `serverstatus.js:18-20` |
| `GET ./artemis-server` | GET | None | Page load (auto) | `receiveArtemisServerAddr()`: if non-empty response, pre-fills `#serveraddr` and shows connected UI state | `serverstatus.js:62-65` |
| `GET ./glitter-address` | GET | None | Page load (auto) | `receivePublicIPs()`: parses JSON array of IP strings, sets `#ownaddress` innerHTML with connection instructions | `serverstatus.js:90-93` |
| `GET ./ship-select/{index}` | GET | None (index in URL path) | Change `#playershipname` | Fire-and-forget | `serverstatus.js:129-131` |

## Socket.IO Events

| Event Name | Direction | Handler | DOM Update | Source |
|------------|-----------|---------|------------|--------|
| `connected` | server → client | `iface.on('connected', ...)` | Hides `#connect` + `#connecting`, shows `#disconnect` + `#vessel-select` | `serverstatus.js:30-35` |
| `disconnected` | server → client | `iface.on('disconnected', ...)` | Shows `#connect`, hides others, enables `#serveraddr`, hides `#vessel-select` | `serverstatus.js:37-43` |
| `allShipSettings` | server → client | `iface.on('allShipSettings', refreshShipSelector)` | Rebuilds `#playershipname` `<option>` list from ship data array | `serverstatus.js:114` |
| `consoleStatus` | server → client | `iface.on('consoleStatus', ...)` | Calls `refreshShipSelector(model.allShipSettings)` | `serverstatus.js:115-117` |

### Model Events (via `worldmodel.js`)

| Event Name | Handler | DOM Update | Source |
|------------|---------|------------|--------|
| `loaded` | `model.on('loaded', ...)` | If `model.allShipSettings` exists, calls `refreshShipSelector()` | `serverstatus.js:119-124` |

## Notes

- The index page does NOT load `connectionlost.js` — the `#connected` div from layout exists but is never populated or shown on this page.
- The `iface` object is assumed to be a Socket.IO-backed EventEmitter created by `worldmodel.js`.
- The `model` object is also from `worldmodel.js` and holds the game world state.
