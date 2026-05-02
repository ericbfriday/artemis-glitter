import type { PacketDefinition, DecodeResult } from "../../../types";
import { packetName } from "../../../types";
import { BufferReader } from "../../../BufferReader";

export interface DestroyObjectPayload {
  type: number;
  id: number;
}

export const destroyObject: PacketDefinition<"destroyObject", DestroyObjectPayload> = {
  name: packetName("destroyObject"),
  type: 0xcc5a3e30,
  subtype: null,
  subtypeLength: 0,
  decode: (reader: BufferReader): DecodeResult<DestroyObjectPayload> => ({
    kind: "ok",
    value: { type: reader.readByte(), id: reader.readUInt32LE() },
    bytesConsumed: reader.pointer,
  }),
  encode: null,
};
