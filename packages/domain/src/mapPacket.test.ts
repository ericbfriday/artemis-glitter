import { describe, test, expect } from "bun:test";
import { mapPacketToDomainEvents } from "./mapPacket";

describe("mapPacketToDomainEvents", () => {
  test("welcome maps to welcomeReceived", () => {
    const events = mapPacketToDomainEvents("welcome", { str: "Artemis" });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: "welcomeReceived", str: "Artemis" });
  });

  test("version maps to versionReceived", () => {
    const events = mapPacketToDomainEvents("version", { major: 2, minor: 1, patch: 5 });
    expect(events).toEqual([{ kind: "versionReceived", major: 2, minor: 1, patch: 5 }]);
  });

  test("destroyObject maps to entityDestroyed", () => {
    const events = mapPacketToDomainEvents("destroyObject", { type: 1, id: 42 });
    expect(events).toEqual([{ kind: "entityDestroyed", entityType: 1, id: 42 }]);
  });

  test("playerUpdate maps to ownShipUpdated", () => {
    const events = mapPacketToDomainEvents("playerUpdate", { id: 7, energy: 1000 });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("ownShipUpdated");
  });

  test("npcUpdate maps to entityUpdated", () => {
    const events = mapPacketToDomainEvents("npcUpdate", { id: 100, posX: -5000.5 });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("entityUpdated");
  });

  test("heartbeat produces no events", () => {
    const events = mapPacketToDomainEvents("heartbeat", {});
    expect(events).toHaveLength(0);
  });

  test("gameOverReason maps to gameOver", () => {
    const events = mapPacketToDomainEvents("gameOverReason", {
      title: "MISSION COMPLETE",
      reason: "All enemies destroyed",
    });
    expect(events).toEqual([
      { kind: "gameOver", title: "MISSION COMPLETE", reason: "All enemies destroyed" },
    ]);
  });

  test("unknown packet maps to unknownPacket", () => {
    const events = mapPacketToDomainEvents("someNewPacket", {});
    expect(events).toEqual([{ kind: "unknownPacket", type: 0, subtype: null }]);
  });
});
