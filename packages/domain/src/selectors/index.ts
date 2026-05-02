import type { WorldModel, Entity, PlayerShipEntity } from "../model";

export function getPlayerShip(model: WorldModel): PlayerShipEntity | undefined {
  if (model.playerShipID === null) return undefined;
  const entity = model.entities[model.playerShipID];
  if (!entity) return undefined;
  return entity as PlayerShipEntity;
}

export function getEntitiesByType(model: WorldModel, entityType: string): Entity[] {
  return Object.values(model.entities).filter((e) => e.entityType === entityType);
}

export function getNearestEntities(
  model: WorldModel,
  options: { excludeTypes?: string[]; maxCount?: number },
): Entity[] {
  const player = getPlayerShip(model);
  if (!player) return [];

  const excludeTypes = options.excludeTypes ?? [];
  let entities = Object.values(model.entities).filter(
    (e) => e.id !== player.id && !excludeTypes.includes(e.entityType),
  );

  entities.sort((a, b) => {
    const distA = Math.hypot(a.posX - player.posX, a.posY - player.posY, a.posZ - player.posZ);
    const distB = Math.hypot(b.posX - player.posX, b.posY - player.posY, b.posZ - player.posZ);
    return distA - distB;
  });

  if (options.maxCount) {
    entities = entities.slice(0, options.maxCount);
  }

  return entities;
}

export function isConnected(model: WorldModel): boolean {
  return model.connected;
}

export function isGameOver(model: WorldModel): boolean {
  return !model.gameStarted && model.gameOver.title !== null;
}

export function getWeapons(model: WorldModel): WorldModel["weapons"] {
  return model.weapons;
}

export function getEngineering(model: WorldModel): WorldModel["engineering"] {
  return model.engineering;
}
