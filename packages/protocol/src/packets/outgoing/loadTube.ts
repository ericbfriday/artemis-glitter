import type { PacketDefinition, EncodeResult } from "../../types";
import { packetName } from "../../types";
import { encodePacket } from "../encodePacket";

export interface LoadTubePayload {
  tube: number;
  ordnance: number;
}

export const loadTube: PacketDefinition<"loadTube", LoadTubePayload> = {
  name: packetName("loadTube"),
  type: 0x69cc01d9,
  subtype: 0x02,
  subtypeLength: 4,
  decode: () => ({ kind: "malformed" as const, reason: "outgoing-only packet", bytesConsumed: 0 }),
  encode: (_w, payload: LoadTubePayload): EncodeResult =>
    encodePacket(0x69cc01d9, 0x02, (w) => {
      w.writeUInt32LE(payload.tube);
      w.writeUInt32LE(payload.ordnance);
    }),
};
