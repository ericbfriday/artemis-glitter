import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { parseSntFile, SYSTEM_MAP } from "./sntParser";

const FIXTURE_DIR = join(import.meta.dir, "..", "..", "..", "test", "fixtures", "vesselData");

describe("parseSntFile", () => {
  test("returns empty grid for nonexistent file", () => {
    const grid = parseSntFile("/nonexistent", "missing.snt");
    expect(grid).toEqual({});
  });

  test("parses a valid SNT file with expected node count", () => {
    const grid = parseSntFile(FIXTURE_DIR, "test_ship.snt");
    const nodeCount = Object.values(grid)
      .flatMap((yMap) => Object.values(yMap))
      .reduce((sum, zMap) => sum + Object.keys(zMap).length, 0);
    expect(nodeCount).toBe(3);
  });

  test("parses Beam system node at 0,0,0", () => {
    const grid = parseSntFile(FIXTURE_DIR, "test_ship.snt");
    const node = grid[0]?.[0]?.[0];
    expect(node).toBeDefined();
    expect(node!.sys).toBe(0);
    expect(node!.graphicX).toBeCloseTo(1.0);
    expect(node!.graphicY).toBeCloseTo(2.0);
    expect(node!.graphicZ).toBeCloseTo(3.0);
  });

  test("parses Warp system node at 1,0,5", () => {
    const grid = parseSntFile(FIXTURE_DIR, "test_ship.snt");
    const node = grid[1]?.[0]?.[5];
    expect(node).toBeDefined();
    expect(node!.sys).toBe(5);
    expect(node!.graphicX).toBeCloseTo(4.5);
  });

  test("parses Hall system node at -1,1,3", () => {
    const grid = parseSntFile(FIXTURE_DIR, "test_ship.snt");
    const node = grid[-1]?.[1]?.[3];
    expect(node).toBeDefined();
    expect(node!.sys).toBe(-1);
  });

  test("excludes Void nodes from grid", () => {
    const grid = parseSntFile(FIXTURE_DIR, "test_ship.snt");
    expect(grid[-2]?.[-2]?.[0]).toBeUndefined();
    expect(grid[2]?.[2]?.[9]).toBeUndefined();
  });
});

describe("SYSTEM_MAP", () => {
  test("maps all expected system IDs", () => {
    expect(SYSTEM_MAP[0]).toBe("Beam");
    expect(SYSTEM_MAP[5]).toBe("Warp");
    expect(SYSTEM_MAP[-1]).toBe("Hall");
    expect(SYSTEM_MAP[-2]).toBe("Void");
  });
});
