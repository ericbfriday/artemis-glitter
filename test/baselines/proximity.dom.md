# DOM Baseline: Proximity Monitor

| Field | Value |
|-------|-------|
| **Route** | `/proximity` |
| **EJS Template** | `views/proximity.ejs` |
| **JS Controllers** | `public/javascripts/proximity.js`, `public/javascripts/redalert.js`, `public/javascripts/connectionlost.js` |
| **Shared JS** | `public/javascripts/worldmodel.js`, `public/javascripts/angles.js`, `public/javascripts/prettyprint.js` |
| **Stylesheet** | `public/stylesheets/style.css` (via layout), `public/stylesheets/proximity.css` |

## DOM Shape

```
<html>
  <head>
    <title><%= title %></title>
    <link rel="stylesheet" href="/stylesheets/style.css" />
  </head>
  <body>
    <div id="connected"></div>                          <!-- layout.ejs — connection overlay -->

    <link rel="stylesheet" href="/stylesheets/proximity.css" />

    <div id="status"></div>                             <!-- JS-populated: alert status text -->

    <ul>                                                <!-- First group: defensive -->
      <li>
        <span class="w3"> "SHL " </span>
        <span id="proximity-shl" class="w4 r"> "DWN" </span>
        <span id="proximity-shl-toggle" class="toggler on"></span>
      </li>
      <li>
        <span class="w3"> "NEB " </span>
        <span id="proximity-neb" class="w4 r"></span>
        <span id="proximity-neb-toggle" class="toggler on"></span>
      </li>
      <li>
        <span class="w3"> "HZD " </span>
        <span id="proximity-hzd" class="w4 r"></span>
        <span id="proximity-hzd-toggle" class="toggler on"></span>
      </li>
    </ul>

    <ul>                                                <!-- Second group: threats -->
      <li>
        <span class="w3"> "HOS " </span>
        <span id="proximity-hos" class="w4 r"></span>
        <span id="proximity-hos-toggle" class="toggler on"></span>
      </li>
      <li>
        <span class="w3"> "MNE " </span>
        <span id="proximity-mine" class="w4 r"></span>
        <span id="proximity-mine-toggle" class="toggler on"></span>
      </li>
      <li>
        <span class="w3"> "DRN " </span>
        <span id="proximity-drone" class="w4 r"></span>
        <span id="proximity-drone-toggle" class="toggler on"></span>
      </li>
    </ul>

    </table>                                            <!-- LEGACY BUG: orphan closing tag -->

    <!-- Audio elements for alert sounds -->
    <audio src="/voice/proximity-alert.ogg"   preload="auto" id="audio-enemy"></audio>
    <audio src="/voice/incoming-ordnance.ogg" preload="auto" id="audio-drone"></audio>
    <audio src="/voice/mines-detected.ogg"    preload="auto" id="audio-mine"></audio>
    <audio src="/voice/shields-are-down.ogg"  preload="auto" id="audio-shields"></audio>
    <audio src="/voice/red-alert.ogg"         preload="auto" id="audio-redalert"></audio>

    <script src="/socket.io/socket.io.js"></script>
    <script src="/javascripts/angles.js"></script>
    <script src="/javascripts/prettyprint.js"></script>
    <script src="/javascripts/worldmodel.js"></script>
    <script src="/javascripts/connectionlost.js"></script>
    <script src="/javascripts/redalert.js"></script>
    <script src="/javascripts/proximity.js"></script>
  </body>
</html>
```

### Key Element IDs/Classes

| Selector | Source | Purpose |
|----------|--------|---------|
| `#connected` | `layout.ejs:8` | Connection status overlay |
| `#status` | `proximity.ejs:5` | Alert status display area — JS sets innerHTML to colored alert messages |
| `#proximity-shl` | `proximity.ejs:9` | Shield status display: "UP" or "DWN" |
| `#proximity-shl-toggle` | `proximity.ejs:10` | Click toggler for shield alarm |
| `#proximity-neb` | `proximity.ejs:12` | Nebula distance or "IN" |
| `#proximity-neb-toggle` | `proximity.ejs:13` | Click toggler for nebula alarm |
| `#proximity-hzd` | `proximity.ejs:15` | Hazard distance (min of black hole & asteroid) |
| `#proximity-hzd-toggle` | `proximity.ejs:16` | Click toggler for hazard alarm |
| `#proximity-hos` | `proximity.ejs:20` | Hostile vessel distance |
| `#proximity-hos-toggle` | `proximity.ejs:21` | Click toggler for hostile alarm |
| `#proximity-mine` | `proximity.ejs:23` | Mine distance |
| `#proximity-mine-toggle` | `proximity.ejs:24` | Click toggler for mine alarm |
| `#proximity-drone` | `proximity.ejs:26` | Drone distance |
| `#proximity-drone-toggle` | `proximity.ejs:27` | Click toggler for drone alarm |
| `#audio-enemy` | `proximity.ejs:35` | Audio: proximity-alert.ogg |
| `#audio-drone` | `proximity.ejs:37` | Audio: incoming-ordnance.ogg |
| `#audio-mine` | `proximity.ejs:38` | Audio: mines-detected.ogg |
| `#audio-shields` | `proximity.ejs:39` | Audio: shields-are-down.ogg |
| `#audio-redalert` | `proximity.ejs:40` | Audio: red-alert.ogg |
| `.toggler.on` / `.toggler.off` | `proximity.js:238-239` | Toggle class swapped on click |
| `.red` / `.alert` / `.purple` / `.green` | `proximity.js:148-166` | Status text CSS classes |
| `body.red-alert` | `redalert.js:10` | Body class during red alert |

### Status Display States (set on `#status` div)

| Status | innerHTML | CSS Class | Trigger |
|--------|-----------|-----------|---------|
| `hazard` | `NAVIGATIONAL<br>HAZARD` | `.red` | Black hole/asteroid < 1500 |
| `enemy` | `NEARBY<br>HOSTILE` | `.red` | Hostile vessel < 2000 |
| `mine` | `MINEFIELD<br>NEARBY` | `.alert` | Mine < 1200 |
| `redalert` | `RED<br>ALERT` | `.alert` | `model.entities[playerShipID].redAlert` is truthy |
| `drone` | `INCOMING<br>ORDNANCE` | `.alert` | Drone < 2000 |
| `nebula` | `Inside<br>Nebula` | `.purple` | Nebula distance ≤ 3000 |
| `shields` | `RAISE<br>SHIELDS` | `.alert` | `playerShipDamage` event when shields down |
| default/null | `{vesselName}` | `.green` | No active alert |

## Required Behaviors

| # | Behavior | Source |
|---|----------|--------|
| 1 | Every 100ms, `checkProximity()` calculates min distances to each entity type (hostile=4, mine=6, nebula=9, black hole=11, asteroid=12, drone=16) | `proximity.js:19-70` |
| 2 | Nebula distance ≤ 3000 shows "IN"; otherwise shows `distanceToKs(distance - 3000)` | `proximity.js:81-85` |
| 3 | Hazard distance is `Math.min(blackHole, asteroid)` | `proximity.js:77` |
| 4 | Status priority (last wins): nebula → hazard → enemy → redalert → mine → drone | `proximity.js:88-116` |
| 5 | When status changes: stop previous audio, start new audio element `#audio-{status}` | `proximity.js:130-144` |
| 6 | Distance values written to `#proximity-hos`, `#proximity-mine`, `#proximity-drone`, `#proximity-neb`, `#proximity-hzd` | `proximity.js:124-128` |
| 7 | On `iface.on('playerShipDamage')` with shields down: show "RAISE SHIELDS", play `#audio-shields`, lock out proximity checks for 2500ms | `proximity.js:182-202` |
| 8 | On `iface.on('ownShipUpdate')` with `shieldState`: update `#proximity-shl` to "UP" or "DWN" | `proximity.js:206-216` |
| 9 | On `iface.on('gameOverReason')`: pause current audio | `proximity.js:220-226` |
| 10 | Each `*-toggle` span is clickable: toggles the corresponding alarm in `alarmEnabled` object and swaps class between `toggler on` / `toggler off` | `proximity.js:231-247` |
| 11 | Red alert toggles `body.red-alert` class via `redalert.js` | `redalert.js:4-16` |
| 12 | Connection status overlay via `connectionlost.js` | `connectionlost.js:81-113` |
| 13 | Allied vessels (isEnemy === false) are excluded from hostile distance calculation | `proximity.js:61-64` |

## Update Cadence

| Timer | Interval | What It Updates | Source |
|-------|----------|-----------------|--------|
| `window.setInterval(checkProximity, 100)` | 100ms | Recalculates all min distances, updates distance display spans, updates status div and audio | `proximity.js:177` |
| `window.setTimeout(..., 2500)` | 2500ms (one-shot) | Unlocks `checkingProximity` mutex after shields-down damage alert | `proximity.js:198-200` |

## Known Legacy Bugs

| # | Bug | File:Line | Details |
|---|-----|-----------|---------|
| 1 | **`checkingProximity` early-return inside entity loop** | `proximity.js:43-45` | The guard `if (!model.entities.hasOwnProperty(model.playerShipID)) { return; }` is inside the `for (var i in model.entities)` loop but causes a bare `return` from the entire `checkProximity()` function **without** resetting `checkingProximity = false` (line 173). If this return is hit, the mutex is left locked and no further proximity checks will ever run until a `playerShipDamage` timeout resets it. |
| 2 | **Orphan `</table>` closing tag** | `proximity.ejs:31` | There is a stray `</table>` closing tag with no corresponding opening `<table>`. Browser will silently ignore it but it's invalid HTML. |
| 3 | **`minDistances[5]` (Space Station) converted but never displayed** | `proximity.js:120` | `minDistances[5] = distanceToKs(minDistances[5])` is computed but there is no corresponding DOM element to display space station distance. The value is calculated but discarded. Also, `minDistances[5]` is never initialized in the `minDistances` object (line 29 has it commented out), so `distanceToKs(undefined)` is called. |
| 4 | **No `#audio-hazard` or `#audio-nebula` elements** | `proximity.ejs:32-34` | The audio elements for nebula and hazard are commented out in the EJS template, but the code on `proximity.js:139-143` tries to play `document.getElementById('audio-' + status)` for `status='nebula'` and `status='hazard'`. These will be `null`, and while there's a null check, no audio plays for these alerts. |
| 5 | **Nebula enter/exit sound handlers are empty** | `proximity.js:90-95` | The `if (!insideNebula)` and `if (insideNebula)` blocks are empty. The `insideNebula` flag (line 6) is declared but never updated, so the tracking of nebula entry/exit state is broken. |
| 6 | **Global loop variable `i` in toggler setup** | `proximity.js:231` | `for (i in alarmEnabled)` uses an undeclared `i` (no `var`), creating an implicit global. This is a minor issue but could interfere with other globals. |
