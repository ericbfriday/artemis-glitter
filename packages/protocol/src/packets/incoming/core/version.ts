import type { PacketDefinition, DecodeResult } from "../../../types";
import { packetName } from "../../../types";
import { BufferReader } from "../../../BufferReader";

export interface VersionPayload {
  unknown1: number;
  unknown2: number;
  major: number;
  minor: number;
  patch: number;
}

export const version: PacketDefinition<"version", VersionPayload> = {
  name: packetName("version"),
  type: 0xe548e74a,
  subtype: null,
  subtypeLength: 0,
  decode: (reader: BufferReader): DecodeResult<VersionPayload> => {
    const unknown1 = reader.readUInt32LE();
    const unknown2 = reader.readUInt32LE();
    const major = reader.readUInt32LE();
    const minor = reader.readUInt32LE();
    const patch = reader.readUInt32LE();
    return {
      kind: "ok",
      value: { unknown1, unknown2, major, minor, patch },
      bytesConsumed: reader.pointer,
    };
  },
  encode: null,
};
