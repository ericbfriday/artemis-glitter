import { describe, test, expect } from "bun:test";
import { createInitialWorldModel } from "./model";
import { replayEvents, applyDomainEvent } from "./reducer";
import type { DomainEvent } from "./events";

describe("reducer", () => {
  test("welcomeReceived sets connected to true", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    const next = applyDomainEvent(model, { kind: "welcomeReceived", str: "Artemis" });
    expect(next.connected).toBe(true);
    expect(model.connected).toBe(false);
  });

  test("versionReceived updates serverVersion", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    const next = applyDomainEvent(model, {
      kind: "versionReceived",
      major: 2,
      minor: 1,
      patch: 5,
    });
    expect(next.serverVersion).toEqual({ major: 2, minor: 1, patch: 5 });
  });

  test("ownShipUpdated sets playerShipID", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    const next = applyDomainEvent(model, {
      kind: "ownShipUpdated",
      entity: { id: 1010, energy: 1000 } as never,
    });
    expect(next.playerShipID).toBe(1010);
    expect(next.entities[1010]).toBeDefined();
  });

  test("entityUpdated adds entity to entities", () => {
    const model = createInitialWorldModel({ playerShipIndex: 0 });
    const next = applyDomainEvent(model, {
      kind: "entityUpdated",
      entity: { id: 42, posX: 100 } as never,
    });
    expect(next.entities[42]).toBeDefined();
  });

  test("entityDestroyed removes entity", () => {
    let model = createInitialWorldModel({ playerShipIndex: 0 });
    model = applyDomainEvent(model, {
      kind: "entityUpdated",
      entity: { id: 42 } as never,
    });
    expect(model.entities[42]).toBeDefined();
    model = applyDomainEvent(model, {
      kind: "entityDestroyed",
      entityType: 1,
      id: 42,
    });
    expect(model.entities[42]).toBeUndefined();
  });

  test("gameOver sets gameStarted to false", () => {
    let model = createInitialWorldModel({ playerShipIndex: 0 });
    model = { ...model, gameStarted: true };
    const next = applyDomainEvent(model, {
      kind: "gameOver",
      title: "MISSION COMPLETE",
      reason: "All enemies destroyed",
    });
    expect(next.gameStarted).toBe(false);
    expect(next.gameOver.title).toBe("MISSION COMPLETE");
  });

  test("replayEvents applies a sequence of events", () => {
    const events: DomainEvent[] = [
      { kind: "welcomeReceived", str: "Artemis" },
      { kind: "versionReceived", major: 2, minor: 1, patch: 5 },
      { kind: "ownShipUpdated", entity: { id: 1010, energy: 800 } as never },
      { kind: "entityUpdated", entity: { id: 200, posX: -5000 } as never },
      { kind: "gameOver", title: "END", reason: "timeout" },
    ];

    const final = replayEvents(createInitialWorldModel({ playerShipIndex: 0 }), events);
    expect(final.connected).toBe(true);
    expect(final.serverVersion.major).toBe(2);
    expect(final.playerShipID).toBe(1010);
    expect(final.entities[200]).toBeDefined();
    expect(final.gameStarted).toBe(false);
    expect(final.gameOver.title).toBe("END");
  });

  test("reducer does not mutate original model", () => {
    const original = createInitialWorldModel({ playerShipIndex: 0 });
    const next = applyDomainEvent(original, {
      kind: "versionReceived",
      major: 2,
      minor: 1,
      patch: 5,
    });
    expect(original.serverVersion.major).toBeNull();
    expect(next.serverVersion.major).toBe(2);
  });
});
