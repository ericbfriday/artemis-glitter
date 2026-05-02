import type { PacketDefinition, DecodeResult } from "../../../types";
import { packetName } from "../../../types";
import { BufferReader } from "../../../BufferReader";

export interface PlayerUpdatePayload {
  id: number;
  energy?: number;
  weaponsTarget?: number;
  impulse?: number;
  rudder?: number;
  maxImpulse?: number;
  turnRate?: number;
  autoBeams?: number;
  warp?: number;
  shieldState?: number;
  shipNumber?: number;
  shipType?: number;
  posX?: number;
  posY?: number;
  posZ?: number;
  heading?: number;
  velocity?: number;
  shipName?: string;
  forShields?: number;
  forShieldsMax?: number;
  aftShields?: number;
  aftShieldsMax?: number;
  redAlert?: number;
  mainScreen?: number;
  beamFrequency?: number;
  coolantAvailable?: number;
  driveType?: number;
}

function readBitField(reader: BufferReader, byteLen: number): boolean[] {
  return reader.readBitArray(byteLen);
}

function readConditionalFloat(
  reader: BufferReader,
  bits: boolean[],
  idx: number,
): number | undefined {
  return bits[idx] ? reader.readFloatLE() : undefined;
}

function readConditionalLong(
  reader: BufferReader,
  bits: boolean[],
  idx: number,
): number | undefined {
  return bits[idx] ? reader.readUInt32LE() : undefined;
}

function readConditionalByte(
  reader: BufferReader,
  bits: boolean[],
  idx: number,
): number | undefined {
  return bits[idx] ? reader.readByte() : undefined;
}

function readConditionalShort(
  reader: BufferReader,
  bits: boolean[],
  idx: number,
): number | undefined {
  return bits[idx] ? reader.readUInt16LE() : undefined;
}

function readConditionalString(
  reader: BufferReader,
  bits: boolean[],
  idx: number,
): string | undefined {
  return bits[idx] ? reader.readUtf16String() : undefined;
}

export const playerUpdate: PacketDefinition<"playerUpdate", PlayerUpdatePayload> = {
  name: packetName("playerUpdate"),
  type: 0x80803df9,
  subtype: 0x01,
  subtypeLength: 1,
  decode: (reader: BufferReader): DecodeResult<PlayerUpdatePayload> => {
    const id = reader.readUInt32LE();
    const bits = readBitField(reader, 5);

    const value: PlayerUpdatePayload = { id };

    // Byte 0: bits 0-7 (reversed from docs)
    value.weaponsTarget = readConditionalLong(reader, bits, 7);
    value.impulse = readConditionalFloat(reader, bits, 6);
    value.rudder = readConditionalFloat(reader, bits, 5);
    value.maxImpulse = readConditionalFloat(reader, bits, 4);
    value.turnRate = readConditionalFloat(reader, bits, 3);
    value.autoBeams = readConditionalByte(reader, bits, 2);
    value.warp = readConditionalByte(reader, bits, 1);
    value.energy = readConditionalFloat(reader, bits, 0);

    // Byte 1: bits 8-15
    value.shieldState = readConditionalShort(reader, bits, 15);
    value.shipNumber = readConditionalLong(reader, bits, 14);
    value.shipType = readConditionalLong(reader, bits, 13);
    value.posX = readConditionalFloat(reader, bits, 12);
    value.posY = readConditionalFloat(reader, bits, 11);
    value.posZ = readConditionalFloat(reader, bits, 10);
    value.heading = readConditionalFloat(reader, bits, 9);
    value.velocity = readConditionalFloat(reader, bits, 8);

    // Byte 2: bits 16-23 (selected relevant fields)
    value.shipName = readConditionalString(reader, bits, 20);
    value.forShields = readConditionalFloat(reader, bits, 19);
    value.forShieldsMax = readConditionalFloat(reader, bits, 18);
    value.aftShields = readConditionalFloat(reader, bits, 17);
    value.aftShieldsMax = readConditionalFloat(reader, bits, 16);

    // Byte 3-4: bits 24-39 (selected relevant fields)
    value.redAlert = readConditionalByte(reader, bits, 30);
    value.mainScreen = readConditionalByte(reader, bits, 28);
    value.beamFrequency = readConditionalByte(reader, bits, 27);
    value.coolantAvailable = readConditionalByte(reader, bits, 26);
    value.driveType = readConditionalLong(reader, bits, 39);

    return { kind: "ok", value, bytesConsumed: reader.pointer };
  },
  encode: null,
};
