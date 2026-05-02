import type { PacketDefinition, EncodeResult } from "../../types";
import { packetName } from "../../types";
import { encodePacket } from "../encodePacket";

export interface GameMasterMessagePayload {
  destination: number;
  origin: string;
  body: string;
}

export const gameMasterMessage: PacketDefinition<"gameMasterMessage", GameMasterMessagePayload> = {
  name: packetName("gameMasterMessage"),
  type: 0x809305a7,
  subtype: null,
  subtypeLength: 0,
  decode: () => ({ kind: "malformed" as const, reason: "outgoing-only packet", bytesConsumed: 0 }),
  encode: (_w, payload: GameMasterMessagePayload): EncodeResult =>
    encodePacket(0x809305a7, null, (w) => {
      w.writeUInt32LE(payload.destination);
      w.writeUtf16String(payload.origin);
      w.writeUtf16String(payload.body);
    }),
};
