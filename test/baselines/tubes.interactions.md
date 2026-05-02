# Interaction Baseline: Torpedo Tubes Matrix

| Field | Value |
|-------|-------|
| **Route** | `/tubes` |
| **JS Controllers** | `public/javascripts/tubes.js`, `public/javascripts/redalert.js`, `public/javascripts/connectionlost.js` |
| **Shared JS** | `public/javascripts/worldmodel.js` |

## Click Targets

### Tube Action Cells

Each cell `#load{tube}{ordnance}` (where tube=1-6, ordnance=0-3) has a click listener that calls `tubeAction(tube, ordnance)`.

| Target Pattern | Selector | Cells | Source |
|----------------|----------|-------|--------|
| Tube/ordnance cells | `#load10` through `#load63` | 24 cells total (6 tubes × 4 ordnance types) | `tubes.js:187-194` |

### `tubeAction(tube, ordnance)` Decision Logic

| Condition | Action | XHR Sent | Source |
|-----------|--------|----------|--------|
| `used == 1` (loaded) AND `ordnance == contents` (same type loaded) | **Fire tube** | `GET ./fire-tube/{tube}` | `tubes.js:167-170` |
| `used == 1` (loaded) AND `ordnance != contents` (different type) | **Unload then auto-load** | `GET ./unload-tube/{tube}` + sets `pendingAutoLoad[tube] = ordnance` | `tubes.js:171-176` |
| `used == 0` (empty) | **Load ordnance** | `GET ./load-tube/{tube}/{ordnance}` | `tubes.js:177-181` |
| `used == 2` (loading) | **Ignored** — no action | None | `tubes.js:183` |
| `used == 3` (unloading) | **Ignored** — no action | None | `tubes.js:183` |

### Auto-Load Mechanism

When a tube finishes unloading (state transitions to `used == 0`) and `pendingAutoLoad[tube]` is set, the code automatically sends `GET ./load-tube/{tube}/{pendingAutoLoad[tube]}` and clears the pending state (`tubes.js:85-90`).

## Keyboard Interactions

None. No keyboard event handlers are registered.

## XHR/Fetch Requests

| # | URL Pattern | Method | Payload | Trigger | Response Handling | Source |
|---|-------------|--------|---------|---------|-------------------|--------|
| 1 | `GET ./fire-tube/{tube}` | GET | None (tube index 1-6 in URL) | Click on loaded tube's matching ordnance cell | Fire-and-forget | `tubes.js:169-170` |
| 2 | `GET ./unload-tube/{tube}` | GET | None (tube index 1-6 in URL) | Click on loaded tube's different ordnance cell | Fire-and-forget; also sets `pendingAutoLoad` | `tubes.js:174-175` |
| 3 | `GET ./load-tube/{tube}/{ordnance}` | GET | None (tube 1-6, ordnance 0-3 in URL) | Click on empty tube cell, OR auto-load after unload completes | Fire-and-forget | `tubes.js:180-181`, `tubes.js:87-88` |
| 4 | `GET ./artemis-server` | GET | None | Page load (via `connectionlost.js`) | Sets `model.connected`, calls `checkConnected()` | `connectionlost.js:106-109` |

### Ordnance Type Mapping

| Index | Type | Column Header |
|-------|------|---------------|
| 0 | Torpedo (Homing) | TRP |
| 1 | Nuke | NUK |
| 2 | Mine | MNE |
| 3 | EMP | EMP |

## Socket.IO Events Subscribed

### Via `iface` (Socket.IO interface)

| # | Event Name | Handler | DOM Update | Source |
|---|------------|---------|------------|--------|
| 1 | `weaponsUpdate` | `updateTubes(data)` | Updates `#currentStores0-3` with current ordnance counts. For each tube 1-6: reads `tubeUsed{i}` and `tubeContents{i}` from `model.weapons`, sets each cell's innerHTML to LOAD/FIRE/WAIT/EMPTY divs with appropriate classes. Applies loading/unloading gradient backgrounds. Triggers pending auto-loads on unload completion. | `tubes.js:203` |
| 2 | `playerUpdate` | (via `redalert.js`) | If own ship and `redAlert` property present: sets `body.className` to `'red-alert'` or `''` | `redalert.js:4-16` |
| 3 | `connected` | (via `connectionlost.js`) | Updates `#connected` overlay | `connectionlost.js:81` |
| 4 | `disconnected` | (via `connectionlost.js`) | Updates `#connected` overlay | `connectionlost.js:82` |
| 5 | `allShipSettings` | (via `connectionlost.js`) | Updates `#connected` overlay | `connectionlost.js:83` |
| 6 | `consoleStatus` | (via `connectionlost.js`) | Updates `#connected` overlay | `connectionlost.js:84` |
| 7 | `version` | (via `connectionlost.js`) | Updates `#connected` overlay | `connectionlost.js:85` |
| 8 | `skybox` | (via `connectionlost.js`) | `checkConnected()` + hides `#connected` | `connectionlost.js:86-87` |
| 9 | `gameStart` | (via `connectionlost.js`) | `checkConnected()` + hides `#connected` | `connectionlost.js:88-89` |
| 10 | `gameOverReason` | (via `connectionlost.js`) | Game over screen in `#connected` | `connectionlost.js:90` |
| 11 | `gameOverStats` | (via `connectionlost.js`) | Appends stats | `connectionlost.js:91` |
| 12 | `gameOver` | (via `connectionlost.js`) | `checkConnected()` | `connectionlost.js:92` |

### Via `model` (world model events)

| # | Event Name | Handler | DOM Update | Source |
|---|------------|---------|------------|--------|
| 1 | `ownShipInit` | `initTubes(shipType)` | Shows/hides `#tube1`-`#tube6` rows based on ship's tube count. Sets `#maxStores0`-`#maxStores3` with max ordnance capacities from `model.vesselData`. | `tubes.js:201` |
| 2 | `loaded` | Anonymous | Calls `updateTubes(model.weapons)` to render initial tube state | `tubes.js:205-207` |
| 3 | `glitterDisconnect` | (via `connectionlost.js`) | Shows disconnect error in `#connected` | `connectionlost.js:94` |

## Tube State Machine

```
  ┌─────────┐   click (load)    ┌──────────┐   loaded      ┌──────────┐
  │  EMPTY  │ ────────────────→ │ LOADING  │ ────────────→ │  LOADED  │
  │ used=0  │                   │  used=2  │               │  used=1  │
  └─────────┘                   └──────────┘               └──────────┘
       ↑                                                        │
       │           unloaded                   click (unload)    │
       │    ┌────────────────┐                  or switch       │
       └────│  UNLOADING     │ ←────────────────────────────────┘
            │   used=3       │
            └────────────────┘
                    │
                    │ if pendingAutoLoad[tube] set
                    ↓
              auto-send load-tube XHR → transitions back to LOADING
```

## CSS Classes Used in Tube Cells

| Class | Meaning | Visual |
|-------|---------|--------|
| `.load` | Tube empty, ordnance available to load | Standard "LOAD" button |
| `.fire` | Tube loaded with this ordnance, ready to fire | Fire action button |
| `.switch` | Tube loaded with different ordnance, click to switch | Alternative load option |
| `.loading` | Tube is loading (with gradient progress) | "WAIT" with green gradient |
| `.unloading` | Tube is unloading (with gradient progress) | "WAIT" with blue gradient |
| `.wait` | Tube busy, non-matching ordnance column | Inactive "WAIT" |
| `.empty` | No stores remaining for this ordnance type | "EMPTY" indicator |
