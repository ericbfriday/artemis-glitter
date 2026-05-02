export type EntityType =
  | "playerShip"
  | "npc"
  | "station"
  | "mine"
  | "drone"
  | "asteroid"
  | "nebula"
  | "anomaly"
  | "blackHole"
  | "monster"
  | "torpedo"
  | "whale"
  | "unknown";

export interface BaseEntity {
  id: number;
  entityType: EntityType;
  name: string;
  posX: number;
  posY: number;
  posZ: number;
}

export interface PlayerShipEntity extends BaseEntity {
  entityType: "playerShip";
  impulse: number;
  rudder: number;
  maxImpulse: number;
  turnRate: number;
  autoBeams: number;
  warp: number;
  energy: number;
  shieldState: number;
  shipNumber: number;
  shipType: number;
  heading: number;
  velocity: number;
  forShields: number;
  forShieldsMax: number;
  aftShields: number;
  aftShieldsMax: number;
  redAlert: number;
  mainScreen: number;
  beamFrequency: number;
  coolantAvailable: number;
  driveType: number;
  weaponsTarget: number;
}

export interface NpcEntity extends BaseEntity {
  entityType: "npc";
  impulseMax: number;
  turnRateMax: number;
  isEnemy: number;
  shipType: number;
  heading: number;
  velocity: number;
  surrendered: number;
  forShields: number;
  forShieldsMax: number;
  aftShields: number;
  aftShieldsMax: number;
  scanned: number;
  faction: number;
}

export interface StationEntity extends BaseEntity {
  entityType: "station";
}

export interface MineEntity extends BaseEntity {
  entityType: "mine";
}

export interface DroneEntity extends BaseEntity {
  entityType: "drone";
}

export interface AsteroidEntity extends BaseEntity {
  entityType: "asteroid";
}

export interface NebulaEntity extends BaseEntity {
  entityType: "nebula";
}

export interface AnomalyEntity extends BaseEntity {
  entityType: "anomaly";
}

export interface TorpedoEntity extends BaseEntity {
  entityType: "torpedo";
}

export type Entity =
  | PlayerShipEntity
  | NpcEntity
  | StationEntity
  | MineEntity
  | DroneEntity
  | AsteroidEntity
  | NebulaEntity
  | AnomalyEntity
  | TorpedoEntity
  | BaseEntity;

export interface ShipSetting {
  shipType: number;
  driveType: number;
  unknown: number;
  name: string;
}

export interface GameOverState {
  title: string | null;
  reason: string | null;
  stats: Array<{ count: number; label: string }>;
}

export interface WeaponsState {
  id: number | null;
  storesHoming: number;
  storesNukes: number;
  storesMines: number;
  storesEMPs: number;
  unknown1: number;
  unloadTime: number[];
  tubeUsed: number[];
  tubeContents: number[];
}

export interface EngineeringState {
  id: number | null;
  heat: Record<string, number>;
  energy: Record<string, number>;
  coolant: Record<string, number>;
}

export interface WorldModel {
  connected: boolean;
  serverVersion: { major: number | null; minor: number | null; patch: number | null };
  entities: Record<number, Entity>;
  comms: Record<number, unknown>;
  incomingAudio: Record<number, unknown>;
  intel: Record<number, unknown>;
  playerShipID: number | null;
  playerShipIndex: number | null;
  playerShipType: number | null;
  engineering: EngineeringState;
  weapons: WeaponsState;
  allShipSettings: ShipSetting[];
  gameStarted: boolean;
  gamePaused: number;
  damconNodes: Record<number, unknown>;
  damconTeams: Record<number, unknown>;
  skybox: number | null;
  difficulty: number | null;
  serverIPs: string[];
  vesselData: Record<string, unknown>;
  factionData: Record<string, unknown>;
  gameOver: GameOverState;
}

export function createInitialWorldModel(config: { playerShipIndex: number }): WorldModel {
  return {
    connected: false,
    serverVersion: { major: null, minor: null, patch: null },
    entities: {},
    comms: {},
    incomingAudio: {},
    intel: {},
    playerShipID: null,
    playerShipIndex: config.playerShipIndex,
    playerShipType: null,
    engineering: {
      id: null,
      heat: {},
      energy: {},
      coolant: {},
    },
    weapons: {
      id: null,
      storesHoming: 0,
      storesNukes: 0,
      storesMines: 0,
      storesEMPs: 0,
      unknown1: 0,
      unloadTime: [],
      tubeUsed: [],
      tubeContents: [],
    },
    allShipSettings: [],
    gameStarted: false,
    gamePaused: 0,
    damconNodes: {},
    damconTeams: {},
    skybox: null,
    difficulty: null,
    serverIPs: [],
    vesselData: {},
    factionData: {},
    gameOver: { title: null, reason: null, stats: [] },
  };
}
