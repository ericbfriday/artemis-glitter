export class BufferWriterOverflowError extends Error {
  constructor(
    public readonly needed: number,
    public readonly cap: number,
  ) {
    super(`Buffer overflow: needed ${needed} bytes but cap is ${cap}`);
    this.name = "BufferWriterOverflowError";
  }
}

const MAX_BUFFER_SIZE = 1024 * 1024;
const DEFAULT_INITIAL_SIZE = 2048;

export class BufferWriter {
  private buf: Uint8Array;
  private view: DataView;
  public pointer: number;

  constructor(initialSize?: number) {
    const size = initialSize ?? DEFAULT_INITIAL_SIZE;
    this.buf = new Uint8Array(size);
    this.view = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
    this.pointer = 0;
  }

  private ensure(bytes: number): void {
    const needed = this.pointer + bytes;
    if (needed <= this.buf.length) return;

    let newSize = this.buf.length;
    while (newSize < needed) {
      newSize *= 2;
    }
    if (newSize > MAX_BUFFER_SIZE) {
      throw new BufferWriterOverflowError(needed, MAX_BUFFER_SIZE);
    }

    const newBuf = new Uint8Array(newSize);
    newBuf.set(this.buf);
    this.buf = newBuf;
    this.view = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
  }

  writeByte(val: number): this {
    return this.writeUInt8(val);
  }

  writeUInt8(val: number): this {
    this.ensure(1);
    this.buf[this.pointer] = val & 0xff;
    this.pointer += 1;
    return this;
  }

  writeUInt16LE(val: number): this {
    this.ensure(2);
    this.view.setUint16(this.pointer, val, true);
    this.pointer += 2;
    return this;
  }

  writeUInt32LE(val: number): this {
    this.ensure(4);
    this.view.setUint32(this.pointer, val >>> 0, true);
    this.pointer += 4;
    return this;
  }

  writeInt32LE(val: number): this {
    this.ensure(4);
    this.view.setInt32(this.pointer, val, true);
    this.pointer += 4;
    return this;
  }

  writeFloatLE(val: number): this {
    this.ensure(4);
    this.view.setFloat32(this.pointer, val, true);
    this.pointer += 4;
    return this;
  }

  writeUtf16String(str: string): this {
    const charCount = str.length;
    this.ensure(4 + charCount * 2 + 2);

    this.writeUInt32LE(charCount + 1);
    for (let i = 0; i < charCount; i++) {
      this.view.setUint16(this.pointer, str.charCodeAt(i), true);
      this.pointer += 2;
    }
    this.view.setUint16(this.pointer, 0, true);
    this.pointer += 2;

    return this;
  }

  writeAsciiString(str: string): this {
    const byteLen = str.length;
    this.ensure(4 + byteLen);

    this.writeUInt32LE(byteLen);
    for (let i = 0; i < byteLen; i++) {
      this.buf[this.pointer] = str.charCodeAt(i) & 0xff;
      this.pointer += 1;
    }

    return this;
  }

  writeBitArray(bits: boolean[], byteLen?: number): this {
    const totalBytes = byteLen ?? Math.ceil(bits.length / 8);
    this.ensure(totalBytes);

    for (let byteIdx = 0; byteIdx < totalBytes; byteIdx++) {
      let byte = 0;
      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        const bitPos = byteIdx * 8 + bitIdx;
        if (bitPos < bits.length && bits[bitPos]) {
          byte |= 1 << bitIdx;
        }
      }
      this.buf[this.pointer + byteIdx] = byte;
    }
    this.pointer += totalBytes;

    return this;
  }

  writeBytes(data: Uint8Array): this {
    this.ensure(data.length);
    this.buf.set(data, this.pointer);
    this.pointer += data.length;
    return this;
  }

  patchUInt32LE(offset: number, value: number): this {
    this.view.setUint32(offset, value >>> 0, true);
    return this;
  }

  toBuffer(): Uint8Array {
    return this.buf.slice(0, this.pointer);
  }
}
