import { BufferWriter } from "../BufferWriter";
import type { EncodeResult } from "../types";

export function encodePacket(
  type: number,
  subtype: number | null,
  writePayload: (w: BufferWriter) => void,
): EncodeResult {
  try {
    const payloadWriter = new BufferWriter();
    writePayload(payloadWriter);
    const payloadBuf = payloadWriter.toBuffer();

    const subtypeBytes = subtype !== null ? 4 : 0;
    const bytesRemaining = payloadBuf.length + subtypeBytes + 4;
    const packetLength = bytesRemaining + 20;

    const header = new BufferWriter(24 + subtypeBytes);
    header.writeUInt32LE(0xdeadbeef);
    header.writeUInt32LE(packetLength);
    header.writeUInt32LE(0);
    header.writeUInt32LE(0);
    header.writeUInt32LE(bytesRemaining);
    header.writeUInt32LE(type);
    if (subtype !== null) {
      header.writeUInt32LE(subtype);
    }

    const result = new BufferWriter(header.pointer + payloadBuf.length);
    result.writeBytes(header.toBuffer());
    result.writeBytes(payloadBuf);

    return { kind: "ok", buffer: result.toBuffer() };
  } catch (e) {
    return { kind: "error", reason: String(e) };
  }
}
