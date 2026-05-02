import { XMLParser } from "fast-xml-parser";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface Vessel {
  faction: string;
  classname: string;
  frontShields?: string;
  rearShields?: string;
  beams: Record<string, string>[];
  tubes: Record<string, string>[];
  torpedoStorage: Record<string, string>;
  engines: Record<string, string>[];
  description: string;
  performance?: Record<string, string>;
  sntFile?: string;
}

export interface Faction {
  name: string;
  taunts: Record<string, string>[];
}

export interface VesselData {
  version: string;
  vessels: Record<string, Vessel>;
  factions: Record<string, Faction>;
}

type Attr = Record<string, string | undefined>;

interface XmlRace {
  "@_ID": string;
  "@_name": string;
  taunt?: Array<{ "@_text": string; "@_cooldown": string; "@_trigger": string }> | undefined;
}

interface XmlVessel {
  "@_uniqueID": string;
  "@_side": string;
  "@_classname": string;
  beam_port?: Array<Attr> | undefined;
  torpedo_tube?: Array<Attr> | undefined;
  torpedo_storage?: Attr | Array<Attr> | undefined;
  engine_port?: Array<Attr> | undefined;
  long_desc?: { "@_text": string } | undefined;
  shields?: { "@_front": string; "@_back": string } | undefined;
  performance?: Attr | undefined;
  internal_data?: { "@_file": string } | undefined;
}

interface XmlRoot {
  "@_version"?: string;
  hullRace?: XmlRace[] | undefined;
  vessel?: XmlVessel[] | undefined;
}

function str(val: string | undefined, fallback = ""): string {
  return val ?? fallback;
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

export function loadVesselData(datDir: string): VesselData {
  const filePath = resolve(datDir, "vesselData.xml");

  if (!existsSync(filePath)) {
    return { version: "", vessels: {}, factions: {} };
  }

  let raw = readFileSync(filePath);

  while (raw.length > 0 && raw[0] !== 0x3c) {
    raw = raw.slice(1);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name: string) => {
      if (name === "hullRace" || name === "vessel") return true;
      if (name === "beam_port" || name === "torpedo_tube" || name === "engine_port") return true;
      if (name === "torpedo_storage" || name === "taunt") return true;
      return false;
    },
  });

  const parsed: Record<string, unknown> = parser.parse(raw) as Record<string, unknown>;
  const root = (parsed["vesselData"] ?? parsed) as XmlRoot;

  const version = str(root["@_version"]);
  const vessels: Record<string, Vessel> = {};
  const factions: Record<string, Faction> = {};

  for (const race of root.hullRace ?? []) {
    const id = race["@_ID"];
    const name = str(race["@_name"]);
    const taunts = toArray(race.taunt).map((t) => ({
      text: str(t["@_text"]),
      cooldown: str(t["@_cooldown"]),
      trigger: str(t["@_trigger"]),
    }));
    factions[id] = { name, taunts };
  }

  for (const node of root.vessel ?? []) {
    const uniqueID = node["@_uniqueID"];

    const vessel: Vessel = {
      faction: str(node["@_side"]),
      classname: str(node["@_classname"]),
      beams: toArray(node.beam_port).map((b) => ({
        damage: str(b["@_damage"]),
        arcWidth: str(b["@_arcWidth"]),
        cycletime: str(b["@_cycletime"]),
        range: str(b["@_range"]),
      })),
      tubes: toArray(node.torpedo_tube).map((t) => ({
        x: str(t["@_x"]),
        y: str(t["@_y"]),
        z: str(t["@_z"]),
      })),
      torpedoStorage: {},
      engines: toArray(node.engine_port).map((e) => ({
        x: str(e["@_x"]),
        y: str(e["@_y"]),
        z: str(e["@_z"]),
      })),
      description: str(node.long_desc?.["@_text"]),
    };

    if (node.shields) {
      vessel.frontShields = node.shields["@_front"];
      vessel.rearShields = node.shields["@_back"];
    }

    if (node.performance) {
      vessel.performance = {
        turnRate: str(node.performance["@_turnRate"]),
        topSpeed: str(node.performance["@_topSpeed"]),
        boost: str(node.performance["@_boost"]),
      };
    }

    const storageEntries = toArray(node.torpedo_storage);
    for (const s of storageEntries) {
      const type = s["@_type"];
      const amount = str(s["@_amount"], "0");
      if (type !== undefined) {
        vessel.torpedoStorage[type] = amount;
      }
    }

    vessels[uniqueID] = vessel;
  }

  return { version, vessels, factions };
}
