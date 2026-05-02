import { describe, test, expect, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadVesselData } from "./vesselData";

const FIXTURE_DIR = join(import.meta.dir, "..", "..", "..", "test", "fixtures", "vesselData");
const TMP_DIR = join(import.meta.dir, "..", "tmp-vessel-test");

describe("loadVesselData", () => {
  afterEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
  });

  test("returns empty data when file does not exist", () => {
    const result = loadVesselData("/nonexistent/path");
    expect(result.vessels).toEqual({});
    expect(result.factions).toEqual({});
    expect(result.version).toBe("");
  });

  test("parses factions from vesselData.xml", () => {
    const result = loadVesselData(FIXTURE_DIR);
    expect(result.version).toBe("2.1");
    expect(Object.keys(result.factions)).toHaveLength(2);
    expect(result.factions["0"]!.name).toBe("Player");
    expect(result.factions["0"]!.taunts).toHaveLength(2);
    expect(result.factions["1"]!.name).toBe("Torgoth");
    expect(result.factions["1"]!.taunts).toHaveLength(1);
  });

  test("parses vessels with shields and beams", () => {
    const result = loadVesselData(FIXTURE_DIR);
    const scout = result.vessels["0"];
    expect(scout).toBeDefined();
    expect(scout!.classname).toBe("Scout");
    expect(scout!.faction).toBe("0");
    expect(scout!.frontShields).toBe("80");
    expect(scout!.rearShields).toBe("60");
    expect(scout!.beams).toHaveLength(2);
    expect(scout!.beams[0]!.damage).toBe("1");
  });

  test("parses torpedo tubes and storage", () => {
    const result = loadVesselData(FIXTURE_DIR);
    const scout = result.vessels["0"];
    expect(scout!.tubes).toHaveLength(1);
    expect(scout!.torpedoStorage).toEqual({ "0": "20", "1": "10" });
  });

  test("parses engines and performance", () => {
    const result = loadVesselData(FIXTURE_DIR);
    const scout = result.vessels["0"];
    expect(scout!.engines).toHaveLength(1);
    expect(scout!.performance).toBeDefined();
    expect(scout!.performance!.topSpeed).toBe("1.2");
  });

  test("parses description", () => {
    const result = loadVesselData(FIXTURE_DIR);
    expect(result.vessels["0"]!.description).toBe("Light scout vessel");
    expect(result.vessels["1"]!.description).toBe("Heavy cruiser");
  });

  test("handles BOM-prefixed file", () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const xml = '<vesselData version="bom"><hullRace ID="0" name="Test"/></vesselData>';
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml)]);
    writeFileSync(join(TMP_DIR, "vesselData.xml"), bom);

    const result = loadVesselData(TMP_DIR);
    expect(result.version).toBe("bom");
    expect(result.factions["0"]!.name).toBe("Test");
  });
});
