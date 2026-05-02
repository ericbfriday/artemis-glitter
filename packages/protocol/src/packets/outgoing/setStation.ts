import type { PacketDefinition, EncodeResult } from "../../types";
import { packetName } from "../../types";
import { encodePacket } from "../encodePacket";

export interface SetStationPayload {
  station: number;
  selected: number;
}

export const setStation: PacketDefinition<"setStation", SetStationPayload> = {
  name: packetName("setStation"),
  type: 0x4c821d3c,
  subtype: 0x0e,
  subtypeLength: 4,
  decode: () => ({ kind: "malformed" as const, reason: "outgoing-only packet", bytesConsumed: 0 }),
  encode: (_w, payload: SetStationPayload): EncodeResult =>
    encodePacket(0x4c821d3c, 0x0e, (w) => {
      w.writeUInt32LE(payload.station);
      w.writeUInt32LE(payload.selected);
    }),
};
