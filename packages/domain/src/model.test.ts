import { describe, test, expect } from "bun:test";
import { createInitialWorldModel } from "./model";

describe("WorldModel", () => {
  test("createInitialWorldModel returns expected defaults", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    expect(model.connected).toBe(false);
    expect(model.serverVersion.major).toBeNull();
    expect(model.entities).toEqual({});
    expect(model.playerShipIndex).toBe(0);
    expect(model.playerShipID).toBeNull();
    expect(model.gameStarted).toBe(false);
    expect(model.gamePaused).toBe(0);
    expect(model.allShipSettings).toEqual([]);
    expect(model.gameOver.title).toBeNull();
    expect(model.weapons.id).toBeNull();
    expect(model.engineering.id).toBeNull();
  });

  test("createInitialWorldModel is pure — no shared mutable state", () => {
    const a = createInitialWorldModel({ playerShipIndex: 0 });
    const b = createInitialWorldModel({ playerShipIndex: 1 });
    a.entities[1] = { id: 1, entityType: "asteroid", name: "", posX: 0, posY: 0, posZ: 0 };
    expect(b.entities[1]).toBeUndefined();
    expect(a.playerShipIndex).toBe(0);
    expect(b.playerShipIndex).toBe(1);
  });

  test("weapons state has empty arrays", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    expect(model.weapons.unloadTime).toEqual([]);
    expect(model.weapons.tubeUsed).toEqual([]);
    expect(model.weapons.tubeContents).toEqual([]);
  });
});
