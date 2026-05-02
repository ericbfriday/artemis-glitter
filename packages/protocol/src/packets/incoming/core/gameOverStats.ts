import type { PacketDefinition, DecodeResult } from "../../../types";
import { packetName } from "../../../types";
import { BufferReader } from "../../../BufferReader";

export interface GameOverStat {
  count: number;
  label: string;
}

export interface GameOverStatsPayload {
  column: number;
  stats: GameOverStat[];
}

export const gameOverStats: PacketDefinition<"gameOverStats", GameOverStatsPayload> = {
  name: packetName("gameOverStats"),
  type: 0xf754c8fe,
  subtype: 0x15,
  subtypeLength: 4,
  decode: (reader: BufferReader): DecodeResult<GameOverStatsPayload> => {
    const column = reader.readByte();
    reader.readByte(); // first separator
    const stats: GameOverStat[] = [];

    let separator = 0x01;
    while (separator !== 0xce) {
      const count = reader.readUInt32LE();
      const label = reader.readUtf16String();
      stats.push({ count, label });
      separator = reader.readByte();
    }

    return { kind: "ok", value: { column, stats }, bytesConsumed: reader.pointer };
  },
  encode: null,
};
