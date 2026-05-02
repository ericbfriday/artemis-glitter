export const PACKAGE_NAME = "@artemis-glitter/protocol";

export { BufferReader, BufferReaderRangeError } from "./BufferReader";
export { BufferWriter, BufferWriterOverflowError } from "./BufferWriter";
export { PacketRegistry } from "./registry";
export { FrameDecoder } from "./frameDecoder";
export type { FrameResult } from "./frameDecoder";
export { packetName, HEADER_SIZE, MAGIC } from "./types";
export type {
  DecodeResult,
  EncodeResult,
  PacketName,
  PacketDefinition,
  PacketHeader,
} from "./types";
