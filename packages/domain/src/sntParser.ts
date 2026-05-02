import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export const SYSTEM_MAP: Record<number, string> = {
  [-2]: "Void",
  [-1]: "Hall",
  0: "Beam",
  1: "Torp",
  2: "Sens",
  3: "Mnvr",
  4: "Impl",
  5: "Warp",
  6: "Fshd",
  7: "Rshd",
};

export interface SntNode {
  sys: number;
  graphicX: number;
  graphicY: number;
  graphicZ: number;
}

export type SntGrid = Record<number, Record<number, Record<number, SntNode>>>;

const BYTES_PER_NODE = 32;
const VOID_SYSTEM = -2;

export function parseSntFile(datDir: string, filename: string): SntGrid {
  const filePath = resolve(datDir, filename);

  if (!existsSync(filePath)) {
    return {};
  }

  const buf = readFileSync(filePath);
  const grid: SntGrid = {};
  let offset = 0;

  for (let x = -2; x <= 2; x++) {
    grid[x] = {};
    for (let y = -2; y <= 2; y++) {
      grid[x]![y] = {};
      for (let z = 0; z <= 9; z++) {
        const graphicX = buf.readFloatLE(offset);
        const graphicY = buf.readFloatLE(offset + 4);
        const graphicZ = buf.readFloatLE(offset + 8);
        const sys = buf.readInt32LE(offset + 12);

        if (sys !== VOID_SYSTEM) {
          grid[x]![y]![z] = { sys, graphicX, graphicY, graphicZ };
        }

        offset += BYTES_PER_NODE;
      }
    }
  }

  return grid;
}
