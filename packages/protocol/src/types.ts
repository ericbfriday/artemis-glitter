import type { BufferReader } from "./BufferReader";
import type { BufferWriter } from "./BufferWriter";

export type DecodeResult<T> =
  | { kind: "ok"; value: T; bytesConsumed: number }
  | { kind: "incomplete"; need: number }
  | { kind: "unknown"; type: number; subtype: number | null; bytesConsumed: number }
  | { kind: "malformed"; reason: string; bytesConsumed: number };

export type EncodeResult = { kind: "ok"; buffer: Uint8Array } | { kind: "error"; reason: string };

export type PacketName = string;

export function packetName<T extends string>(name: T): T {
  return name;
}

export interface PacketDefinition<TName extends string = string, TPayload = unknown> {
  name: TName;
  type: number;
  subtype: number | null;
  subtypeLength: 0 | 1 | 4;
  decode: (reader: BufferReader) => DecodeResult<TPayload>;
  encode: ((writer: BufferWriter, payload: TPayload) => EncodeResult) | null;
}

export type PacketHeader = {
  magic: number;
  packetLength: number;
  origin: number;
  unknown: number;
  bytesRemaining: number;
  type: number;
  subtype: number | null;
};

export const HEADER_SIZE = 24;
export const MAGIC = 0xdeadbeef;
