import { describe, test, expect } from "bun:test";
import { createInitialWorldModel } from "../model";
import { applyDomainEvent } from "../reducer";
import {
  getPlayerShip,
  getEntitiesByType,
  getNearestEntities,
  isConnected,
  isGameOver,
} from "./index";

describe("selectors", () => {
  test("getPlayerShip returns undefined when no ship", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    expect(getPlayerShip(model)).toBeUndefined();
  });

  test("getPlayerShip returns ship after ownShipUpdated", () => {
    let model = createInitialWorldModel({ playerShipIndex: 0 });
    model = applyDomainEvent(model, {
      kind: "ownShipUpdated",
      entity: { id: 1010, energy: 500, posX: 0, posY: 0, posZ: 0 } as never,
    });
    const ship = getPlayerShip(model);
    expect(ship).toBeDefined();
    expect(ship!.id).toBe(1010);
  });

  test("getEntitiesByType filters by type", () => {
    let model = createInitialWorldModel({ playerShipIndex: 0 });
    model = applyDomainEvent(model, {
      kind: "entityUpdated",
      entity: { id: 1, entityType: "asteroid" } as never,
    });
    model = applyDomainEvent(model, {
      kind: "entityUpdated",
      entity: { id: 2, entityType: "npc" } as never,
    });
    expect(getEntitiesByType(model, "asteroid")).toHaveLength(1);
    expect(getEntitiesByType(model, "npc")).toHaveLength(1);
  });

  test("getNearestEntities sorts by distance from player", () => {
    let model = createInitialWorldModel({ playerShipIndex: 0 });
    model = applyDomainEvent(model, {
      kind: "ownShipUpdated",
      entity: { id: 0, posX: 0, posY: 0, posZ: 0 } as never,
    });
    model = applyDomainEvent(model, {
      kind: "entityUpdated",
      entity: { id: 1, posX: 100, posY: 0, posZ: 0 } as never,
    });
    model = applyDomainEvent(model, {
      kind: "entityUpdated",
      entity: { id: 2, posX: 10, posY: 0, posZ: 0 } as never,
    });
    const nearest = getNearestEntities(model, { maxCount: 1 });
    expect(nearest).toHaveLength(1);
    expect(nearest[0]!.id).toBe(2);
  });

  test("isConnected reflects connection state", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    expect(isConnected(model)).toBe(false);
    const next = applyDomainEvent(model, { kind: "welcomeReceived", str: "" });
    expect(isConnected(next)).toBe(true);
  });

  test("isGameOver detects game over state", () => {
    let model = createInitialWorldModel({ playerShipIndex: 0 });
    expect(isGameOver(model)).toBe(false);
    model = applyDomainEvent(model, { kind: "gameOver", title: "END", reason: "done" });
    expect(isGameOver(model)).toBe(true);
  });
});
