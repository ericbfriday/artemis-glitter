import type { DomainEvent } from "./events";
import type { ShipSetting } from "./model";

type PacketPayload = Record<string, unknown>;

export function mapPacketToDomainEvents(packetName: string, payload: PacketPayload): DomainEvent[] {
  switch (packetName) {
    case "welcome":
      return [{ kind: "welcomeReceived", str: typeof payload.str === "string" ? payload.str : "" }];

    case "version":
      return [
        {
          kind: "versionReceived",
          major: Number(payload.major ?? 0),
          minor: Number(payload.minor ?? 0),
          patch: Number(payload.patch ?? 0),
        },
      ];

    case "playerUpdate":
      return [{ kind: "ownShipUpdated", entity: payload as never }];

    case "npcUpdate":
    case "stationUpdate":
    case "asteroidUpdate":
    case "mineUpdate":
    case "droneUpdate":
    case "nebulaUpdate":
    case "anomalyUpdate":
    case "torpedoUpdate":
    case "whaleUpdate":
    case "unknownObjectUpdate":
      return [{ kind: "entityUpdated", entity: payload as never }];

    case "destroyObject":
      return [
        {
          kind: "entityDestroyed",
          entityType: Number(payload.type ?? 0),
          id: Number(payload.id ?? 0),
        },
      ];

    case "allShipSettings": {
      const settings: ShipSetting[] = [];
      for (let i = 0; i < 8; i++) {
        const ship = payload[i] as ShipSetting | undefined;
        if (ship) {
          settings.push(ship);
        }
      }
      return [{ kind: "shipSettingsUpdated", settings }];
    }

    case "weaponsUpdate":
      return [{ kind: "weaponsUpdated", weapons: payload }];

    case "engineeringUpdate":
      return [{ kind: "engineeringUpdated", engineering: payload }];

    case "gameOver":
      return [{ kind: "gameOver", title: "", reason: "" }];

    case "gameOverReason":
      return [
        {
          kind: "gameOver",
          title: typeof payload.title === "string" ? payload.title : "",
          reason: typeof payload.reason === "string" ? payload.reason : "",
        },
      ];

    case "gameOverStats":
      return [
        {
          kind: "gameOverStats",
          column: Number(payload.column ?? 0),
          stats: (payload.stats ?? []) as Array<{ count: number; label: string }>,
        },
      ];

    case "gameStart":
      return [{ kind: "gameStarted" }];

    case "difficulty":
      return [{ kind: "difficultyChanged", difficulty: Number(payload.difficulty ?? 0) }];

    case "togglePause":
      return [{ kind: "pauseToggled", paused: Number(payload.paused ?? 0) }];

    case "skybox":
      return [{ kind: "skyboxUpdated", skybox: Number(payload.skybox ?? 0) }];

    case "commsIncoming":
      return [{ kind: "commsReceived", comms: payload }];

    case "intel":
      return [{ kind: "intelReceived", intel: payload }];

    case "damcon":
      return [{ kind: "damconUpdated", damcon: payload }];

    case "heartbeat":
    case "consoleStatus":
    case "beamFired":
    case "incomingAudio":
    case "soundEffect":
    case "playerShipDamage":
    case "cloakFlash":
    case "dmxMessage":
    case "keyCapture":
    case "jumpStart":
    case "jumpCompleted":
    case "gameRestart":
      return [];

    default:
      return [{ kind: "unknownPacket", type: 0, subtype: null }];
  }
}
