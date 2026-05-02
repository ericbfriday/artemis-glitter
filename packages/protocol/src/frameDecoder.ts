import { BufferReader } from "./BufferReader";
import { PacketRegistry } from "./registry";
import { HEADER_SIZE, MAGIC, type PacketHeader } from "./types";

export type FrameResult =
  | { kind: "packet"; header: PacketHeader; payload: unknown }
  | { kind: "incomplete"; need: number }
  | { kind: "unknown"; header: PacketHeader }
  | { kind: "malformed"; reason: string; bytesConsumed: number };

export class FrameDecoder {
  private buffer = new Uint8Array(0);
  private registry: PacketRegistry;

  constructor(registry: PacketRegistry) {
    this.registry = registry;
  }

  feed(bytes: Uint8Array): FrameResult[] {
    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer, 0);
    merged.set(bytes, this.buffer.length);
    this.buffer = merged;

    const results: FrameResult[] = [];

    while (this.buffer.length >= HEADER_SIZE) {
      const result = this.tryDecodeFrame();
      results.push(result);
      if (result.kind === "incomplete") break;
    }

    return results;
  }

  private tryDecodeFrame(): FrameResult {
    if (this.buffer.length < HEADER_SIZE) {
      return { kind: "incomplete", need: HEADER_SIZE - this.buffer.length };
    }

    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);

    const magic = view.getUint32(0, true);
    if (magic !== MAGIC) {
      const consumed = this.buffer.length;
      this.buffer = new Uint8Array(0);
      return {
        kind: "malformed",
        reason: `Invalid magic: 0x${magic.toString(16)}`,
        bytesConsumed: consumed,
      };
    }

    const packetLength = view.getUint32(4, true);
    const origin = view.getUint32(8, true);
    const unknown = view.getUint32(12, true);
    const bytesRemaining = view.getUint32(16, true);
    const type = view.getUint32(20, true);

    const totalFrameLength = HEADER_SIZE + bytesRemaining;
    if (this.buffer.length < totalFrameLength) {
      return { kind: "incomplete", need: totalFrameLength - this.buffer.length };
    }

    let subtype: number | null = null;
    let payloadOffset = HEADER_SIZE;

    const def = this.registry.getByType(type);
    if (def && def.subtypeLength > 0) {
      if (bytesRemaining < def.subtypeLength) {
        this.advance(totalFrameLength);
        return {
          kind: "malformed",
          reason: "Subtype exceeds remaining bytes",
          bytesConsumed: totalFrameLength,
        };
      }
      if (def.subtypeLength === 1) {
        subtype = this.buffer[HEADER_SIZE]!;
      } else {
        subtype = view.getUint32(HEADER_SIZE, true);
      }
      payloadOffset = HEADER_SIZE + def.subtypeLength;
    }

    const payloadBytes = this.buffer.slice(payloadOffset, HEADER_SIZE + bytesRemaining);

    const header: PacketHeader = {
      magic,
      packetLength,
      origin,
      unknown,
      bytesRemaining,
      type,
      subtype,
    };

    const actualDef =
      subtype !== null ? this.registry.getByType(type, subtype) : this.registry.getByType(type);

    if (!actualDef) {
      this.advance(totalFrameLength);
      return { kind: "unknown", header };
    }

    const reader = new BufferReader(payloadBytes);
    const result = actualDef.decode(reader);

    this.advance(totalFrameLength);

    if (result.kind === "ok") {
      return { kind: "packet", header, payload: result.value };
    }

    return {
      kind: "malformed",
      reason: result.kind === "malformed" ? result.reason : "decode failed",
      bytesConsumed: totalFrameLength,
    };
  }

  private advance(n: number): void {
    this.buffer = this.buffer.slice(n);
  }
}
