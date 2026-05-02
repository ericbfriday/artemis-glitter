import type { PacketDefinition, DecodeResult } from "../../../types";
import { packetName } from "../../../types";
import { BufferReader } from "../../../BufferReader";

export interface WelcomePayload {
  str: string;
}

export const welcome: PacketDefinition<"welcome", WelcomePayload> = {
  name: packetName("welcome"),
  type: 0x6d04b3da,
  subtype: null,
  subtypeLength: 0,
  decode: (reader: BufferReader): DecodeResult<WelcomePayload> => ({
    kind: "ok",
    value: { str: reader.readAsciiString() },
    bytesConsumed: reader.pointer,
  }),
  encode: null,
};
