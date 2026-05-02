# DOM Baseline: Debug Map

| Field | Value |
|-------|-------|
| **Route** | `/map` |
| **EJS Template** | `views/map.ejs` |
| **JS Controllers** | `public/javascripts/map.js`, `public/javascripts/connectionlost.js` |
| **Shared JS** | `public/javascripts/worldmodel.js` |
| **External Dependency** | OpenLayers 3 (`http://ol3js.org/en/master/build/ol.js`) |
| **Stylesheet** | `public/stylesheets/style.css` (via layout), OpenLayers CSS (`http://ol3js.org/en/master/css/ol.css`) |

> Note: No `redalert.js` is loaded on the map page.

## DOM Shape

```
<html>
  <head>
    <title><%= title %></title>
    <link rel="stylesheet" href="/stylesheets/style.css" />
  </head>
  <body>
    <div id="connected"></div>                          <!-- layout.ejs — connection overlay -->

    <link rel="stylesheet" href="http://ol3js.org/en/master/css/ol.css" />

    <div id="map" class="map"
         style="position:absolute; top:0; bottom:0; left:0; right:300px;">
      <div id="popup" class="popup"></div>              <!-- OL3 popup overlay -->
    </div>

    <div id="info" class="info"
         style="position:absolute; top:0; bottom:0; right:0px; width:300px;
                border-left: 1px solid #80FF80; overflow-y: auto">

      <div style="border-bottom: 1px solid #80FF80; text-align: center">
        <p> "Artemis-Glitter debug map" </p>
      </div>

      <div style="border-bottom: 1px solid #80FF80; text-align: center">
        <div> "Cursor coordinates:" </div>
        <div id="mouse-position"></div>                 <!-- OL3 MousePosition control target -->
      </div>

      <div style="overflow-y: auto; overflow-x: hidden; font-size:80%"
           id="vesselData">
        <!-- JS-populated: entity data table on click -->
      </div>
    </div>

    <script src="http://ol3js.org/en/master/build/ol.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <script src="/javascripts/worldmodel.js"></script>
    <script src="/javascripts/connectionlost.js"></script>
    <script src="/javascripts/map.js"></script>
  </body>
</html>
```

### Key Element IDs/Classes

| Selector | Source | Purpose |
|----------|--------|---------|
| `#connected` | `layout.ejs:8` | Connection status overlay |
| `#map` / `.map` | `map.ejs:4` | OpenLayers 3 map target container |
| `#popup` / `.popup` | `map.ejs:5` | OL3 overlay element (currently unused — overlay created but no content set) |
| `#info` / `.info` | `map.ejs:8` | Right-side info panel (300px wide) |
| `#mouse-position` | `map.ejs:16` | OL3 MousePosition control output |
| `#vesselData` | `map.ejs:19` | Selected entity data table (populated on click) |
| `body.red-alert` | — | NOT toggled — `redalert.js` is not loaded on this page |

### Entity Styles (from `map.js getStyle()`)

| Entity Type | Stroke Color | Fill Color | Radius | Notes |
|-------------|-------------|------------|--------|-------|
| 1 (player ship) | `#00ff00` | `#40c040` | 5 | Green |
| 5 (enemy) | `#ff0000` | `#c04040` | 5 | Red (if `isEnemy`) |
| 5 (civilian) | `#00ffff` | `#40c0c0` | 5 | Cyan (if not enemy) |
| 6 (station) | `#ffff00` | `#c0c040` | 5 | Yellow |
| 7 (mine) | `#ffffff` | `#666666` | 2 | Small white |
| 10 (nebula) | `rgba(255,0,255,0.05)` | `rgba(192,64,192,0.2)` | 15 | Large magenta |
| 12 (black hole) | `#404040` | `#000000` | 15 | Large dark |
| 13 (asteroid) | `#ffbf80` | `#c06640` | 5 | Orange |
| 15 (monster) | `#ff80ff` | `#804080` | 5 | Pink |
| 16 (whale) | `#00ff80` | `#40c080` | 5 | Green-cyan |
| 17 (drone) | `#ffffff` | `#666666` | 5 | White |
| -1 (beam) | `#ffffff` | `#666666` | 1 | Tiny |
| -4 (cloak flash) | `#ffffff` | `#ffffff` | 2 | White flash |

## Required Behaviors

| # | Behavior | Source |
|---|----------|--------|
| 1 | Creates OL3 map with custom projection (100000×100000 meters), canvas renderer, targeting `#map` div | `map.js:111-178` |
| 2 | Background: static image `/images/map_background_601px.png` (601×601px) stretched to full extent | `map.js:159-166` |
| 3 | Vector layer renders entities as colored circles with optional name labels (Xolonium font) | `map.js:29-106, 128-136` |
| 4 | MousePosition control writes coordinates to `#mouse-position`, with inverted coordinate display (`100000 - x`, `100000 - y`) | `map.js:140-152` |
| 5 | `model.on('newEntity')` and `model.on('updateEntity')`: creates/updates OL3 features. Coordinates inverted as `[100000 - posX, 100000 - posZ]` | `map.js:186-217` |
| 6 | `model.on('destroyEntity')`: removes feature from vector source | `map.js:219-226` |
| 7 | `map.on('singleclick')`: selects a feature at pixel, sets `selectedFeatureID`, calls `showData()` which renders entity properties as a table in `#vesselData` | `map.js:268-289` |
| 8 | `model.on('updateEntity')`: if the updated entity is the selected one, re-renders `#vesselData` | `map.js:262-264` |
| 9 | Connection status overlay via `connectionlost.js` | `connectionlost.js:81-113` |

## Update Cadence

No `setInterval` or `requestAnimationFrame` loops. All updates are event-driven:
- `model.on('newEntity')` — add feature to map
- `model.on('updateEntity')` — move feature on map + refresh info panel if selected
- `model.on('destroyEntity')` — remove feature from map
- `map.on('singleclick')` — user interaction

## Known Legacy Bugs

| # | Bug | File:Line | Details |
|---|-----|-----------|---------|
| 1 | **External CDN dependency on `ol3js.org`** | `map.ejs:2,26` | Both the CSS and JS for OpenLayers 3 are loaded from `http://ol3js.org/en/master/build/ol.js` (HTTP, not HTTPS). This CDN may be defunct/unavailable, and the `master` path means the version is unpinned. A commented-out local fallback exists on line 27. |
| 2 | **Entity type mismatch between map styles and protocol** | `map.js:29` | Comments list type `0x05` as "other ship (enemy or civilian)" and `0x06` as "space station", but `getStyle()` uses decimal values (5, 6). The entity types in the comments don't fully match what `getStyle()` handles (e.g., comment lists `0x0a` for nebula but code uses `10`, which is `0x0a` — this is fine). However, types 8 (anomaly), 11 (torpedo), 14 (generic mesh) have no styles defined — they fall through to the white default. |
| 3 | **`popup` overlay created but never used** | `map.js:122-124` | `var popup = new ol.Overlay({ element: document.getElementById('popup') })` is created but never added to the map or shown. The `#popup` div exists in the DOM but serves no function. |
| 4 | **`white-space: no-break` is invalid CSS** | `map.js:255` | Should be `white-space: nowrap`. The `no-break` value is not a valid CSS value and will be ignored by browsers. |
| 5 | **Global variable leak in `showData()`** | `map.js:249` | `for (key in model.entities[id])` — `key` is not declared with `var`, creating an implicit global. |
