import type { WorldModel, Entity, PlayerShipEntity } from "./model";
import type { DomainEvent } from "./events";

export function applyDomainEvent(model: WorldModel, event: DomainEvent): WorldModel {
  switch (event.kind) {
    case "welcomeReceived":
      return { ...model, connected: true };

    case "versionReceived":
      return {
        ...model,
        serverVersion: {
          major: event.major,
          minor: event.minor,
          patch: event.patch,
        },
      };

    case "ownShipUpdated": {
      const entity = event.entity as Partial<PlayerShipEntity> & { id: number };
      const entities = { ...model.entities, [entity.id]: entity as Entity };
      return {
        ...model,
        entities,
        playerShipID: model.playerShipID ?? entity.id,
        playerShipType: entity.shipType ?? model.playerShipType,
      };
    }

    case "entityUpdated": {
      const entity = event.entity as Partial<Entity> & { id: number };
      const entities = { ...model.entities, [entity.id]: entity as Entity };
      return { ...model, entities };
    }

    case "entityDestroyed": {
      const entities = { ...model.entities };
      delete entities[event.id];
      return { ...model, entities };
    }

    case "shipSettingsUpdated":
      return { ...model, allShipSettings: event.settings };

    case "weaponsUpdated":
      return {
        ...model,
        weapons: {
          ...model.weapons,
          ...Object.fromEntries(Object.entries(event.weapons).filter(([k]) => k !== "id")),
          id: (event.weapons.id as number) ?? model.weapons.id,
        },
      };

    case "engineeringUpdated":
      return {
        ...model,
        engineering: {
          ...model.engineering,
          ...Object.fromEntries(Object.entries(event.engineering).filter(([k]) => k !== "id")),
          id: (event.engineering.id as number) ?? model.engineering.id,
        },
      };

    case "gameOver":
      return {
        ...model,
        gameStarted: false,
        gameOver: {
          ...model.gameOver,
          title: event.title || model.gameOver.title,
          reason: event.reason || model.gameOver.reason,
        },
      };

    case "gameOverStats":
      return {
        ...model,
        gameOver: {
          ...model.gameOver,
          stats: event.stats,
        },
      };

    case "gameStarted":
      return { ...model, gameStarted: true, gamePaused: 0 };

    case "difficultyChanged":
      return { ...model, difficulty: event.difficulty };

    case "pauseToggled":
      return { ...model, gamePaused: event.paused };

    case "skyboxUpdated":
      return { ...model, skybox: event.skybox };

    case "connectionChanged":
      return { ...model, connected: event.connected };

    case "commsReceived":
      return { ...model, comms: { ...model.comms, [Date.now()]: event.comms } };

    case "intelReceived":
      return { ...model, intel: { ...model.intel, [Date.now()]: event.intel } };

    case "damconUpdated":
      return { ...model, damconNodes: { ...model.damconNodes, [Date.now()]: event.damcon } };

    case "unknownPacket":
      return model;

    default:
      return model;
  }
}

export function replayEvents(initial: WorldModel, events: DomainEvent[]): WorldModel {
  return events.reduce(applyDomainEvent, initial);
}
