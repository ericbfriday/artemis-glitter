import type { PacketDefinition, EncodeResult } from "../../types";
import { packetName } from "../../types";
import { encodePacket } from "../encodePacket";

export const ready: PacketDefinition<"ready", Record<string, never>> = {
  name: packetName("ready"),
  type: 0x4c821d3c,
  subtype: 0x0f,
  subtypeLength: 4,
  decode: () => ({ kind: "malformed" as const, reason: "outgoing-only packet", bytesConsumed: 0 }),
  encode: (): EncodeResult => encodePacket(0x4c821d3c, 0x0f, (w) => w.writeUInt32LE(0)),
};
