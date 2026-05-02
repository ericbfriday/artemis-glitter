# Interactions Baseline: Proximity Monitor

| Field | Value |
|-------|-------|
| **Route** | `/proximity` |
| **JS Controllers** | `public/javascripts/proximity.js`, `public/javascripts/redalert.js`, `public/javascripts/connectionlost.js` |
| **Shared JS** | `public/javascripts/worldmodel.js`, `public/javascripts/angles.js`, `public/javascripts/prettyprint.js` |

## Click Targets

| Target | Selector | Action | Source |
|--------|----------|--------|--------|
| Shield alarm toggle | `#proximity-shl-toggle` | Toggles `alarmEnabled.shl` boolean. Swaps class: `toggler on` ↔ `toggler off`. When off, shield-down damage alert is suppressed. | `proximity.js:231-246` |
| Nebula alarm toggle | `#proximity-neb-toggle` | Toggles `alarmEnabled.neb`. Swaps class: `toggler on` ↔ `toggler off`. When off, nebula proximity status is suppressed. | `proximity.js:231-246` |
| Hazard alarm toggle | `#proximity-hzd-toggle` | Toggles `alarmEnabled.hzd`. Swaps class: `toggler on` ↔ `toggler off`. When off, hazard proximity status is suppressed. | `proximity.js:231-246` |
| Hostile alarm toggle | `#proximity-hos-toggle` | Toggles `alarmEnabled.hos`. Swaps class: `toggler on` ↔ `toggler off`. When off, hostile proximity status is suppressed. | `proximity.js:231-246` |
| Mine alarm toggle | `#proximity-mine-toggle` | Toggles `alarmEnabled.mine`. Swaps class: `toggler on` ↔ `toggler off`. When off, mine proximity status is suppressed. | `proximity.js:231-246` |
| Drone alarm toggle | `#proximity-drone-toggle` | Toggles `alarmEnabled.drone`. Swaps class: `toggler on` ↔ `toggler off`. When off, drone proximity status is suppressed. | `proximity.js:231-246` |

### Toggle Implementation Detail

The togglers use a closure pattern to capture the alarm key and element reference:

```javascript
var closure = function(j, t) {
    return function() {
        alarmEnabled[j] = !alarmEnabled[j];
        if (alarmEnabled[j]) {
            t.className = 'toggler on';
        } else {
            t.className = 'toggler off';
        }
    }
}(i, toggler);
toggler.addEventListener('click', closure);
```

## Keyboard Interactions

None. No keyboard event listeners are registered.

## XHR/Fetch Requests

### From `connectionlost.js` (page load)

| URL Pattern | Method | Payload | Trigger | Response Handling | Source |
|-------------|--------|---------|---------|-------------------|--------|
| `GET ./artemis-server` | GET | None | Page load (auto) | Sets `model.connected` and `serverIpAddr`, calls `checkConnected()` | `connectionlost.js:106-109` |

No XHR requests originate from `proximity.js` itself. All game state comes via Socket.IO.

## Socket.IO Events

### From `proximity.js`

| Event Name | Direction | Handler | DOM Update | Source |
|------------|-----------|---------|------------|--------|
| `playerShipDamage` | server → client | `iface.on('playerShipDamage', ...)` | If shields are down (`!model.entities[playerShipID].shieldState`) and `alarmEnabled.shl`: pauses current audio, sets `#status` innerHTML to `<span class="alert">RAISE<br>SHIELDS</span>`, plays `#audio-shields`, locks `checkingProximity` mutex for 2500ms | `proximity.js:182-202` |
| `ownShipUpdate` | server → client | `iface.on('ownShipUpdate', ...)` | If `data.shieldState` property present: sets `#proximity-shl` innerHTML to "UP" (if truthy) or "DWN" (if falsy) | `proximity.js:206-216` |
| `gameOverReason` | server → client | `iface.on('gameOverReason', ...)` | Pauses and resets current status audio element | `proximity.js:220-226` |

### From `redalert.js`

| Event Name | Direction | Handler | DOM Update | Source |
|------------|-----------|---------|------------|--------|
| `playerUpdate` | server → client | `iface.on('playerUpdate', ...)` | If `data.id == model.playerShipID` and `data.redAlert` is truthy: sets `body.className = 'red-alert'`; if falsy: clears body className | `redalert.js:4-16` |

### From `connectionlost.js`

| Event Name | Direction | Handler | DOM Update | Source |
|------------|-----------|---------|------------|--------|
| `connected` | server → client | `checkConnected()` | Updates `#connected` overlay | `connectionlost.js:81` |
| `disconnected` | server → client | `checkConnected()` | Shows disconnect message | `connectionlost.js:82` |
| `allShipSettings` | server → client | `checkConnected()` | Refreshes overlay | `connectionlost.js:83` |
| `consoleStatus` | server → client | `checkConnected()` | Refreshes overlay | `connectionlost.js:84` |
| `version` | server → client | `checkConnected()` | Refreshes overlay | `connectionlost.js:85` |
| `skybox` | server → client | `checkConnected()` + `hideConnectedOverlay()` | Refreshes then hides overlay | `connectionlost.js:86-87` |
| `gameStart` | server → client | `checkConnected()` + `hideConnectedOverlay()` | Refreshes then hides overlay | `connectionlost.js:88-89` |
| `gameOverReason` | server → client | `onGameOverReason(data)` | Shows game-over screen | `connectionlost.js:90` |
| `gameOverStats` | server → client | `showStatistics(data)` | Appends stats to game-over | `connectionlost.js:91` |
| `gameOver` | server → client | `checkConnected()` | Refreshes overlay | `connectionlost.js:92` |

### Model Events

| Event Name | Handler | DOM Update | Source |
|------------|---------|------------|--------|
| `glitterDisconnect` | `onGlitterDisconnect()` | Shows "Connection aborted" in `#connected` | `connectionlost.js:94` |

## Audio Playback Logic

Audio elements are controlled by status transitions in `checkProximity()`:

| Status Transition | Audio Action | Source |
|-------------------|-------------|--------|
| Any → `enemy` | Play `#audio-enemy` (`proximity-alert.ogg`) | `proximity.js:139-143` |
| Any → `drone` | Play `#audio-drone` (`incoming-ordnance.ogg`) | `proximity.js:139-143` |
| Any → `mine` | Play `#audio-mine` (`mines-detected.ogg`) | `proximity.js:139-143` |
| Any → `redalert` | Play `#audio-redalert` (`red-alert.ogg`) | `proximity.js:139-143` |
| `playerShipDamage` (shields down) | Play `#audio-shields` (`shields-are-down.ogg`) | `proximity.js:193` |
| Any → `nebula` | Attempts `#audio-nebula` — element is commented out, so null check passes and no audio plays | `proximity.js:139-143` |
| Any → `hazard` | Attempts `#audio-hazard` — element is commented out, so null check passes and no audio plays | `proximity.js:139-143` |
| Previous status → null | Pause + reset previous audio | `proximity.js:132-138` |
| `gameOverReason` | Pause + reset current audio | `proximity.js:220-226` |

## Proximity Thresholds

| Entity Type | Threshold Distance | Status Triggered | Priority (higher = overrides lower) |
|-------------|-------------------|------------------|--------------------------------------|
| Nebula (type 9) | ≤ 3000 | `nebula` | 1 (lowest) |
| Black Hole/Asteroid (types 11, 12) | < 1500 | `hazard` | 2 |
| Hostile (type 4) | < 2000 | `enemy` | 3 |
| Red Alert (ship flag) | Any (boolean) | `redalert` | 4 |
| Mine (type 6) | < 1200 | `mine` | 5 |
| Drone (type 16) | < 2000 | `drone` | 6 (highest) |
