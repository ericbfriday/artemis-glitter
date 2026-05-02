import type { Entity, ShipSetting } from "./model";

export type DomainEvent =
  | { kind: "welcomeReceived"; str: string }
  | { kind: "versionReceived"; major: number; minor: number; patch: number }
  | { kind: "entityUpdated"; entity: Entity }
  | { kind: "ownShipUpdated"; entity: Entity }
  | { kind: "entityDestroyed"; entityType: number; id: number }
  | { kind: "shipSettingsUpdated"; settings: ShipSetting[] }
  | { kind: "weaponsUpdated"; weapons: Record<string, unknown> }
  | { kind: "engineeringUpdated"; engineering: Record<string, unknown> }
  | { kind: "gameOver"; title: string; reason: string }
  | { kind: "gameOverStats"; column: number; stats: Array<{ count: number; label: string }> }
  | { kind: "gameStarted" }
  | { kind: "difficultyChanged"; difficulty: number }
  | { kind: "pauseToggled"; paused: number }
  | { kind: "connectionChanged"; connected: boolean }
  | { kind: "commsReceived"; comms: Record<string, unknown> }
  | { kind: "intelReceived"; intel: Record<string, unknown> }
  | { kind: "damconUpdated"; damcon: Record<string, unknown> }
  | { kind: "skyboxUpdated"; skybox: number }
  | { kind: "unknownPacket"; type: number; subtype: number | null };
