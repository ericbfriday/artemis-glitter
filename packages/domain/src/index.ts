export const PACKAGE_NAME = "@artemis-glitter/domain";

export { createInitialWorldModel } from "./model";
export type {
  WorldModel,
  Entity,
  PlayerShipEntity,
  ShipSetting,
  EntityType,
  WeaponsState,
  EngineeringState,
} from "./model";

export { applyDomainEvent, replayEvents } from "./reducer";
export { mapPacketToDomainEvents } from "./mapPacket";
export type { DomainEvent } from "./events";

export {
  getPlayerShip,
  getEntitiesByType,
  getNearestEntities,
  isConnected,
  isGameOver,
  getWeapons,
  getEngineering,
} from "./selectors";
