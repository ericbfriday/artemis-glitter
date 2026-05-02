# DOM Baseline: Index (Welcome Page)

| Field | Value |
|-------|-------|
| **Route** | `/` |
| **EJS Template** | `views/index.ejs` |
| **JS Controllers** | `public/javascripts/serverstatus.js`, `public/javascripts/connectionlost.js` (NOT loaded — no `connectionlost.js` script tag on this page) |
| **Shared JS** | `public/javascripts/worldmodel.js` |
| **Stylesheet** | `public/stylesheets/style.css` (via `layout.ejs`) |

> Note: `connectionlost.js` is **not** included via a `<script>` tag on `index.ejs`. Only `worldmodel.js` and `serverstatus.js` are loaded. The layout includes `style.css`.

## DOM Shape

```
<html>
  <head>
    <title><%= title %></title>                         <!-- EJS-injected -->
    <link rel="stylesheet" href="/stylesheets/style.css" />
  </head>
  <body>
    <div id="connected"></div>                          <!-- from layout.ejs; unused on index (no connectionlost.js) -->

    <style>body{overflow:auto}</style>                  <!-- inline override -->

    <h1> "Welcome to Artemis Glitter" </h1>

    <p id="ownaddress" class="margin:3em;"></p>         <!-- JS-populated by receivePublicIPs() -->

    <div style="display:inline-block; min-width:200px;">
      <h2> "Server and ship selection" </h2>
      <p>
        "Artemis server: "
        <input id="serveraddr" />
        <button id="connect"> "Connect" </button>
        <button id="disconnect" style="display:none"> "Disconnect" </button>
        <span id="connecting" style="display:none"> "Connecting..." </span>
      </p>
      <div id="vessel-select" style="display:none">
        "Vessel: "
        <select id="playershipname"></select>           <!-- JS-populated by refreshShipSelector() -->
      </div>
    </div>

    <div style="display:inline-block; min-width:200px;">
      <h2> "Console selection" </h2>
      <ul>
        <li>
          <span class="w4 r"> "BRG" </span>
          <span><a href="bearing-table"> "Bearing-distance table" </a></span>
        </li>
        <li>
          <span class="w4 r"> "PROX" </span>
          <span><a href="proximity"> "Proximity monitor" </a></span>
        </li>
        <li>
          <span class="w4 r"> "TUBE" </span>
          <span><a href="tubes"> "Torpedo tubes matrix" </a></span>
        </li>
      </ul>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script src="/javascripts/worldmodel.js"></script>
    <script src="/javascripts/serverstatus.js"></script>
  </body>
</html>
```

### Key Element IDs/Classes

| Selector | Source | Purpose |
|----------|--------|---------|
| `#connected` | `layout.ejs:8` | Connection overlay div (unused on this page — no `connectionlost.js`) |
| `#ownaddress` | `index.ejs:10` | Displays server IP address help text |
| `#serveraddr` | `index.ejs:16` | Text input for Artemis server IP |
| `#connect` | `index.ejs:17` | Button — initiates connection |
| `#disconnect` | `index.ejs:18` | Button — terminates connection (initially hidden) |
| `#connecting` | `index.ejs:19` | Span — "Connecting..." indicator (initially hidden) |
| `#vessel-select` | `index.ejs:24` | Wrapper div for ship selector (initially hidden) |
| `#playershipname` | `index.ejs:25` | `<select>` — ship dropdown, populated by JS |
| `.w4.r` | `index.ejs:35-37` | Console link label spans |

## Required Behaviors

| # | Behavior | Source |
|---|----------|--------|
| 1 | Clicking `#connect` sends XHR GET to `./connect/<serveraddr>`, hides `#connect`, shows `#connecting`, hides `#disconnect`, disables `#serveraddr` | `serverstatus.js:5-15` |
| 2 | Clicking `#disconnect` sends XHR GET to `./disconnect/`, shows `#connect`, hides `#connecting`+`#disconnect`, enables `#serveraddr`, hides `#vessel-select` | `serverstatus.js:17-27` |
| 3 | On `iface.on('connected')`: hide `#connect`+`#connecting`, show `#disconnect`+`#vessel-select` | `serverstatus.js:30-35` |
| 4 | On `iface.on('disconnected')`: show `#connect`, hide others, enable `#serveraddr`, hide `#vessel-select` | `serverstatus.js:37-43` |
| 5 | On page load: XHR GET `./artemis-server` — if response non-empty, pre-fill `#serveraddr` and show connected state | `serverstatus.js:46-65` |
| 6 | On page load: XHR GET `./glitter-address` — parse JSON array of IPs, set `#ownaddress` innerHTML with connection instructions | `serverstatus.js:70-93` |
| 7 | `refreshShipSelector()`: builds `<option>` elements for `#playershipname` from `model.allShipSettings` data | `serverstatus.js:101-112` |
| 8 | On `iface.on('allShipSettings')` and `iface.on('consoleStatus')`: refresh ship selector | `serverstatus.js:114-117` |
| 9 | On `model.on('loaded')`: refresh ship selector if data available | `serverstatus.js:119-124` |
| 10 | Changing `#playershipname` sends XHR GET `./ship-select/<index>` | `serverstatus.js:126-132` |

## Update Cadence

No `setInterval` or `requestAnimationFrame` loops on this page. All updates are event-driven via Socket.IO (`iface.on(...)`) or `model.on(...)` callbacks.

## Known Legacy Bugs

| # | Bug | File:Line | Details |
|---|-----|-----------|---------|
| 1 | **`publicIPs[0]` used instead of `publicIPs[i]` in loop** | `serverstatus.js:85` | In the multi-IP for-loop `for (i in publicIPs)`, the template string uses `publicIPs[0]` instead of `publicIPs[i]`. All list items display the first IP instead of each respective IP. |
| 2 | **`ownaddress` vs `ownAddress` variable casing mismatch** | `serverstatus.js:72,75,87` | Line 72 declares `var ownAddress = document.getElementById('ownaddress')` (camelCase). Lines 75 and 87 reference `ownaddress` (all lowercase, an implicit global via the element's `id` attribute in some browsers). Line 87 also assigns a string directly to `ownaddress` instead of using `.innerHTML`, which would silently fail in strict mode or non-IE browsers. |
| 3 | **Multi-IP branch assigns string to element reference** | `serverstatus.js:87` | `ownaddress = str;` overwrites the variable/global with a string instead of setting `.innerHTML` on the DOM element. The multi-IP help text is never actually rendered. |
| 4 | **`class="margin:3em;"` is not a valid CSS class name** | `index.ejs:10` | The `<p id="ownaddress">` has `class="margin:3em;"` which looks like an intended inline style but is set as a class attribute. Has no CSS effect. |
