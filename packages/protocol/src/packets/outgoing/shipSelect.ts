import type { PacketDefinition, EncodeResult } from "../../types";
import { packetName } from "../../types";
import { encodePacket } from "../encodePacket";

export interface ShipSelectPayload {
  shipIndex: number;
}

export const shipSelect: PacketDefinition<"shipSelect", ShipSelectPayload> = {
  name: packetName("shipSelect"),
  type: 0x4c821d3c,
  subtype: 0x0d,
  subtypeLength: 4,
  decode: () => ({ kind: "malformed" as const, reason: "outgoing-only packet", bytesConsumed: 0 }),
  encode: (_w, payload: ShipSelectPayload): EncodeResult =>
    encodePacket(0x4c821d3c, 0x0d, (w) => w.writeUInt32LE(payload.shipIndex)),
};
