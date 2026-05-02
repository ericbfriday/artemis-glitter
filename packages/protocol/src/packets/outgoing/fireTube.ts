import type { PacketDefinition, EncodeResult } from "../../types";
import { packetName } from "../../types";
import { encodePacket } from "../encodePacket";

export interface TubePayload {
  tube: number;
}

export const fireTube: PacketDefinition<"fireTube", TubePayload> = {
  name: packetName("fireTube"),
  type: 0x4c821d3c,
  subtype: 0x08,
  subtypeLength: 4,
  decode: () => ({ kind: "malformed" as const, reason: "outgoing-only packet", bytesConsumed: 0 }),
  encode: (_w, payload: TubePayload): EncodeResult =>
    encodePacket(0x4c821d3c, 0x08, (w) => w.writeUInt32LE(payload.tube)),
};
