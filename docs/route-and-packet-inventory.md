# Route & Packet Inventory

This document provides a comprehensive inventory of HTTP routes, Artemis protocol packets, and event listeners in the `artemis-glitter` application.

## HTTP Routes

| Method | Path | Handler Location | Current Behavior | Target POST Replacement |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/` | `routes/index.js:5` | Renders the main server/ship selection page. | `GET /` (Keep as page) |
| GET | `/model` | `public/javascripts/worldmodel.js:494` | Returns the full serialized world model as JSON. | `GET /api/model` |
| GET | `/map` | `routes/index.js:13` | Renders the debug map console page. | `GET /map` (Keep as page) |
| GET | `/bearing-table` | `routes/index.js:21` | Renders the bearing and distance table console page. | `GET /bearing-table` (Keep as page) |
| GET | `/proximity` | `routes/index.js:29` | Renders the proximity monitor console page. | `GET /proximity` (Keep as page) |
| GET | `/tubes` | `routes/index.js:37` | Renders the torpedo tubes matrix console page. | `GET /tubes` (Keep as page) |
| GET | `/connect/:server` | `app.js:147` | Initiates a TCP connection to the specified Artemis server. | `POST /api/connect` |
| GET | `/disconnect` | `app.js:154` | Closes the TCP connection to the Artemis server. | `POST /api/disconnect` |
| GET | `/artemis-server` | `app.js:158` | Returns the current Artemis server address as plain text. | `GET /api/config/server` |
| GET | `/glitter-address` | `app.js:164` | Returns a JSON array of local IPv4 addresses for the Glitter server. | `GET /api/config/ips` |
| GET | `/ship-select/:playerShipIndex` | `app.js:190` | Selects the player ship index and requests consoles. | `POST /api/ship/select` |
| GET | `/unload-tube/:tube` | `app.js:197` | Sends an `unloadTube` packet for the specified tube (1-6). | `POST /api/tubes/unload` |
| GET | `/fire-tube/:tube` | `app.js:202` | Sends a `fireTube` packet for the specified tube (1-6). | `POST /api/tubes/fire` |
| GET | `/load-tube/:tube/:ordnance` | `app.js:207` | Sends a `loadTube` packet for the specified tube and ordnance. | `POST /api/tubes/load` |

## Packet Inventory

Total packet count: 50

| File Path | Name | Type | Subtype | Direction | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `packets/beamFired.js` | `beamFired` | `0xb83fd2c4` | `null` | incoming | Notifies the client that a beam weapon has been fired. |
| `packets/difficulty.js` | `difficulty` | `0x3de66711` | `null` | incoming | Provides game difficulty and type settings. |
| `packets/clientActions2/loadTube.js` | `loadTube` | `0x69cc01d9` | `0x02` | outgoing | Commands the server to load a torpedo tube. |
| `packets/destroyObject.js` | `destroyObject` | `0xcc5a3e30` | `null` | incoming | Notifies that an object has been removed from play. |
| `packets/consoleStatus.js` | `consoleStatus` | `0x19c6e2d4` | `null` | incoming | Provides availability status of bridge consoles. |
| `packets/intel.js` | `intel` | `0xee665279` | `null` | incoming | Provides intelligence messages about entities. |
| `packets/incomingAudio.js` | `incomingAudio` | `0xae88e058` | `null` | incoming | Manages incoming audio messages/files. |
| `packets/version.js` | `version` | `0xe548e74a` | `null` | incoming | Provides the Artemis server version information. |
| `packets/objectUpdate/asteroidUpdate.js` | `asteroidUpdate` | `0x80803df9` | `0x0d` | incoming | Updates the status (position, etc.) of an asteroid. |
| `packets/objectUpdate/npcUpdate.js` | `npcUpdate` | `0x80803df9` | `0x05` | incoming | Updates the status of non-player characters (ships). |
| `packets/objectUpdate/destroyUpdate.js` | `destroyUpdate` | `0x80803df9` | `0x00` | incoming | Duplicate of destroyObject, used in object updates. |
| `packets/objectUpdate/mineUpdate.js` | `mineUpdate` | `0x80803df9` | `0x07` | incoming | Updates the status of a mine. |
| `packets/objectUpdate/engineeringUpdate.js` | `engineeringUpdate` | `0x80803df9` | `0x03` | incoming | Updates heat, energy, and coolant for player ship systems. |
| `packets/objectUpdate/torpedoUpdate.js` | `torpedoUpdate` | `0x80803df9` | `0x0b` | incoming | Updates the status of a player-fired torpedo. |
| `packets/objectUpdate/stationUpdate.js` | `stationUpdate` | `0x80803df9` | `0x06` | incoming | Updates the status of a deep space station. |
| `packets/objectUpdate/droneUpdate.js` | `droneUpdate` | `0x80803df9` | `0x11` | incoming | Updates the status of a drone. |
| `packets/objectUpdate/whaleUpdate.js` | `whaleUpdate` | `0x80803df9` | `0x10` | incoming | Updates the status of a space whale. |
| `packets/objectUpdate/weaponsUpdate.js` | `weaponsUpdate` | `0x80803df9` | `0x02` | incoming | Updates torpedo stores and tube status for player ship. |
| `packets/objectUpdate/anomalyUpdate.js` | `anomalyUpdate` | `0x80803df9` | `0x08` | incoming | Updates the status of an anomaly. |
| `packets/objectUpdate/unknownObjectUpdate.js` | `upgradesUpdate` | `0x80803df9` | `0x04` | incoming | Updates ship upgrades (guesswork implementation). |
| `packets/objectUpdate/nebulaUpdate.js` | `nebulaUpdate` | `0x80803df9` | `0x0a` | incoming | Updates the status and color of a nebula. |
| `packets/objectUpdate/playerUpdate.js` | `playerUpdate` | `0x80803df9` | `0x01` | incoming | Comprehensive update for the player ship status. |
| `packets/objectUpdate/blackHoleUpdate.js` | `blackHoleUpdate` | `0x80803df9` | `0x0c` | incoming | Updates the status of a black hole. |
| `packets/objectUpdate/monsterUpdate.js` | `monsterUpdate` | `0x80803df9` | `0x0f` | incoming | Updates the status of a space monster. |
| `packets/welcome.js` | `welcome` | `0x6d04b3da` | `null` | incoming | Initial welcome message from the server. |
| `packets/gameMessage/cloakFlash.js` | `cloakFlash` | `0xf754c8fe` | `0x07` | incoming | Coordinates for jump or cloak activation effects. |
| `packets/gameMessage/gameMessage.js` | `gameMessage` | `0xf754c8fe` | `0x0a` | incoming | Generic text message from the game. |
| `packets/gameMessage/dmxMessage.js` | `dmxMessage` | `0xf754c8fe` | `0x10` | incoming | DMX lighting control message. |
| `packets/gameMessage/gameOverStats.js` | `gameOverStats` | `0xf754c8fe` | `0x15` | incoming | Statistics displayed at the end of a game. |
| `packets/gameMessage/allShipSettings.js` | `allShipSettings` | `0xf754c8fe` | `0x0f` | incoming | Settings for all player ships in the game. |
| `packets/gameMessage/gameOver.js` | `gameOver` | `0xf754c8fe` | `0x06` | incoming | Signal that the game has ended. |
| `packets/gameMessage/skybox.js` | `skybox` | `0xf754c8fe` | `0x09` | incoming | Specifies the skybox background to use. |
| `packets/gameMessage/togglePause.js` | `togglePause` | `0xf754c8fe` | `0x04` | incoming | Toggles the game pause state. |
| `packets/gameMessage/soundEffect.js` | `soundEffect` | `0xf754c8fe` | `0x03` | incoming | Commands the client to play a specific sound effect. |
| `packets/gameMessage/gameStart.js` | `gameStart` | `0xf754c8fe` | `0x00` | incoming | Signal that the game has started. |
| `packets/gameMessage/jumpCompleted.js` | `jumpCompleted` | `0xf754c8fe` | `0x0d` | incoming | Signal that a jump has been completed. |
| `packets/gameMessage/gameOverReason.js` | `gameOverReason` | `0xf754c8fe` | `0x14` | incoming | Title and reason for the game ending. |
| `packets/gameMessage/gameRestart.js` | `gameRestart` | `0xf754c8fe` | `0x08` | incoming | Signal that the game is (re)starting. |
| `packets/gameMessage/playerShipDamage.js` | `playerShipDamage` | `0xf754c8fe` | `0x05` | incoming | Notifies of damage to the player ship (screen shake). |
| `packets/gameMessage/jumpStart.js` | `jumpStart` | `0xf754c8fe` | `0x0c` | incoming | Signal that a jump is starting. |
| `packets/gameMessage/keyCapture.js` | `keyCapture` | `0xf754c8fe` | `0x11` | incoming | Commands the client to capture or release keys. |
| `packets/heartbeat.js` | `heartbeat` | `0xf5821226` | `null` | incoming | Frequent empty packet used as a heartbeat. |
| `packets/commsIncoming.js` | `commsIncoming` | `0xd672c35f" | `null` | incoming | Incoming communication message with priority and sender. |
| `packets/damcon.js` | `damcon` | `0x077e9f3c` | `null` | incoming | Updates damage grid and DAMCON team status. |
| `packets/clientActions1/setStation.js` | `setStation` | `0x4c821d3c` | `0x0e` | outgoing | Commands the server to select or deselect a console. |
| `packets/clientActions1/fireTube.js` | `fireTube` | `0x4c821d3c` | `0x08` | outgoing | Commands the server to fire a torpedo tube. |
| `packets/clientActions1/shipSelect.js` | `shipSelect` | `0x4c821d3c` | `0x0d` | outgoing | Commands the server to select a player ship. |
| `packets/clientActions1/ready.js` | `ready` | `0x4c821d3c` | `0x0f` | outgoing | Signals the server that the client is ready. |
| `packets/clientActions1/unloadTube.js` | `unloadTube` | `0x4c821d3c` | `0x09` | outgoing | Commands the server to unload a torpedo tube. |
| `packets/gameMasterMessage.js` | `gameMasterMessage` | `0x809305a7` | `null` | outgoing | Sends a message from the Game Master to a console. |

## Event Listeners

| Attachment Location | Event Source | Event Name | Purpose |
| :--- | :--- | :--- | :--- |
| `app.js:99` | `io.sockets` | `connection` | Handles new browser WebSocket connections. |
| `app.js:100` | `artemisNet` | `packet` | Relays all Artemis packets to connected browsers. |
| `app.js:108` | `artemisNet` | `connected` | Notifies browsers of successful Artemis connection. |
| `app.js:112` | `artemisNet` | `disconnected` | Notifies browsers of Artemis disconnection. |
| `app.js:136` | `artemisNet` | `welcome` | Triggers console selection upon being welcomed. |
| `worldmodel.js:100` | `iface` (io) | `connect` | Browser: Logs connection to Glitter server. |
| `worldmodel.js:102` | `iface` (io) | `disconnect` | Browser: Logs disconnection and emits `glitterDisconnect`. |
| `worldmodel.js:111` | `iface` | `connected` | Updates model connection state. |
| `worldmodel.js:115` | `iface` | `disconnected` | Updates model connection state and emits `gameOver`. |
| `worldmodel.js:120` | `iface` | `version` | Updates model server version. |
| `worldmodel.js:124` | `iface` | `gameOver` | Clears world model state on game end. |
| `worldmodel.js:144` | `iface` | `gameRestart` | Sets `gameStarted` to true. |
| `worldmodel.js:173` | `iface` | `playerUpdate` | Updates player ship in world model. |
| `worldmodel.js:194` | `iface` | `npcUpdate` | Updates NPC ships in world model. |
| `worldmodel.js:199` | `iface` | `stationUpdate` | Updates stations in world model. |
| `worldmodel.js:204` | `iface` | `mineUpdate` | Updates mines in world model. |
| `worldmodel.js:209` | `iface` | `anomalyUpdate` | Updates anomalies in world model. |
| `worldmodel.js:214` | `iface` | `nebulaUpdate` | Updates nebulae in world model. |
| `worldmodel.js:219` | `iface` | `torpedoUpdate` | Updates torpedoes in world model. |
| `worldmodel.js:224` | `iface` | `blackHoleUpdate` | Updates black holes in world model. |
| `worldmodel.js:229` | `iface` | `asteroidUpdate` | Updates asteroids in world model. |
| `worldmodel.js:234` | `iface` | `monsterUpdate` | Updates monsters in world model. |
| `worldmodel.js:239` | `iface` | `whaleUpdate` | Updates space whales in world model. |
| `worldmodel.js:244` | `iface` | `droneUpdate` | Updates drones in world model. |
| `worldmodel.js:249` | `iface` | `beamFired` | Updates beam firing events in world model. |
| `worldmodel.js:254` | `iface` | `weaponsUpdate` | Updates weapons status in world model. |
| `worldmodel.js:260` | `iface` | `engineeringUpdate` | Updates engineering status in world model. |
| `worldmodel.js:267` | `iface` | `cloakFlash` | Updates cloak/jump effects in world model. |
| `worldmodel.js:276` | `iface` | `commsIncoming` | Adds incoming comms to world model. |
| `worldmodel.js:291` | `iface` | `destroyObject` | Removes entities from world model. |
| `worldmodel.js:300` | `iface` | `consoleStatus` | Updates player ship index. |
| `worldmodel.js:307` | `iface` | `allShipSettings` | Updates pre-game ship settings. |
| `worldmodel.js:311` | `iface` | `skybox` | Updates skybox and sets `gameStarted`. |
| `worldmodel.js:316` | `iface` | `intel` | Updates intelligence data in world model. |
| `worldmodel.js:320` | `iface` | `togglePause` | Toggles game pause state in model. |
| `worldmodel.js:326` | `iface` | `difficulty` | Updates game difficulty in model. |
| `worldmodel.js:330` | `iface` | `version` | Updates server version in model. |
| `worldmodel.js:335` | `iface` | `damcon` | Updates DAMCON grid and teams in model. |
| `worldmodel.js:354` | `iface` | `incomingAudio` | Updates incoming audio status in model. |
| `worldmodel.js:535` | `iface` | `gameRestart` | Triggers Glitter address broadcast. |
| `worldmodel.js:537` | `iface` | `gameOver` | Resets broadcast state. |
| `proximity.js:182` | `iface` | `playerShipDamage` | Triggers "Raise Shields" alert if shields are down. |
| `proximity.js:206` | `iface` | `ownShipUpdate` | Updates shield status display. |
| `proximity.js:220` | `iface` | `gameOverReason` | Stops looped sounds on game end. |
| `serverstatus.js:114` | `iface` | `allShipSettings` | Refreshes ship selector UI. |
| `serverstatus.js:115` | `iface` | `consoleStatus` | Refreshes ship selector UI. |

## Behavior Preservation Checklist

| Behavior to preserve | Covered by fixture |
| :--- | :--- |
| Start a local Glitter server, defaulting to port `3000`. | |
| Connect/disconnect to an Artemis server on TCP port `2010`. | |
| Select player ship index. | |
| Request the same station set on welcome: main screen, observer, game master, then ready. | |
| Relay parsed Artemis packets to connected browsers. | |
| Hydrate clients with the current world model on load. | |
| Maintain entities, comms, intel, incoming audio, ship settings, engineering, weapons, damcon, skybox, difficulty, game started/paused state, server version, and vessel/faction data. | |
| Show connection/game-over overlay across consoles. | |
| Show bearing-distance table of nearby vessels. | |
| Show proximity monitor with shield/nebula/hazard/hostile/mine/drone status and audio alerts. | |
| Show torpedo tube stores/status and issue load/unload/fire commands. | |
| Preserve or replace the debug map with equivalent world-model inspection. | |
| Broadcast Glitter address into Artemis game-master/comms once the simulation starts. | |
| Support `--headless` and `--server <addr>` or equivalent Bun CLI flags. | |
