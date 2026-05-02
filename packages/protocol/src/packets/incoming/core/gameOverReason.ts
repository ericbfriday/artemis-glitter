import type { PacketDefinition, DecodeResult } from "../../../types";
import { packetName } from "../../../types";
import { BufferReader } from "../../../BufferReader";

export interface GameOverReasonPayload {
  title: string;
  reason: string;
}

export const gameOverReason: PacketDefinition<"gameOverReason", GameOverReasonPayload> = {
  name: packetName("gameOverReason"),
  type: 0xf754c8fe,
  subtype: 0x14,
  subtypeLength: 4,
  decode: (reader: BufferReader): DecodeResult<GameOverReasonPayload> => ({
    kind: "ok",
    value: { title: reader.readUtf16String(), reason: reader.readUtf16String() },
    bytesConsumed: reader.pointer,
  }),
  encode: null,
};
