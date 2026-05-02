export class BufferReaderRangeError extends Error {
  constructor(
    public readonly offset: number,
    public readonly needed: number,
    public readonly available: number,
  ) {
    super(`Read at offset ${offset} needs ${needed} bytes but only ${available} available`);
    this.name = "BufferReaderRangeError";
  }
}

export class BufferReader {
  private view: DataView;
  private uint8: Uint8Array;
  public pointer: number;

  constructor(buffer: ArrayBufferView | Uint8Array | ArrayBuffer) {
    if (buffer instanceof ArrayBuffer) {
      this.uint8 = new Uint8Array(buffer);
      this.view = new DataView(buffer);
    } else if (buffer instanceof Uint8Array) {
      this.uint8 = buffer;
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      this.uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    this.pointer = 0;
  }

  get length(): number {
    return this.uint8.length;
  }

  get remaining(): number {
    return this.uint8.length - this.pointer;
  }

  private ensure(bytes: number): void {
    if (this.pointer + bytes > this.uint8.length) {
      throw new BufferReaderRangeError(this.pointer, bytes, this.remaining);
    }
  }

  readByte(): number {
    this.ensure(1);
    const val = this.uint8[this.pointer]!;
    this.pointer += 1;
    return val;
  }

  readUInt8(): number {
    return this.readByte();
  }

  readUInt16LE(): number {
    this.ensure(2);
    const val = this.view.getUint16(this.pointer, true);
    this.pointer += 2;
    return val;
  }

  readUInt32LE(): number {
    this.ensure(4);
    const val = this.view.getUint32(this.pointer, true);
    this.pointer += 4;
    return val;
  }

  readInt32LE(): number {
    this.ensure(4);
    const val = this.view.getInt32(this.pointer, true);
    this.pointer += 4;
    return val;
  }

  readFloatLE(): number {
    this.ensure(4);
    const val = this.view.getFloat32(this.pointer, true);
    this.pointer += 4;
    return val;
  }

  readUtf16String(): string {
    const charCountPlusOne = this.readUInt32LE();
    const charCount = charCountPlusOne - 1;
    this.ensure(charCount * 2 + 2);

    let result = "";
    for (let i = 0; i < charCount; i++) {
      result += String.fromCharCode(this.view.getUint16(this.pointer, true));
      this.pointer += 2;
    }

    const nullTerm = this.view.getUint16(this.pointer, true);
    this.pointer += 2;
    if (nullTerm !== 0) {
      // Legacy code warns but continues — we do the same
    }
    return result;
  }

  readAsciiString(): string {
    const byteLen = this.readUInt32LE();
    this.ensure(byteLen);

    let result = "";
    for (let i = 0; i < byteLen; i++) {
      result += String.fromCharCode(this.uint8[this.pointer]!);
      this.pointer += 1;
    }
    return result;
  }

  readBitArray(byteLen: number): boolean[] {
    this.ensure(byteLen);
    const bits: boolean[] = [];
    for (let byteIdx = 0; byteIdx < byteLen; byteIdx++) {
      const byte = this.uint8[this.pointer + byteIdx]!;
      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        bits.push(Boolean(byte & (1 << bitIdx)));
      }
    }
    this.pointer += byteLen;
    return bits;
  }

  peek(offset?: number): number {
    const pos = offset ?? this.pointer;
    if (pos >= this.uint8.length) {
      throw new BufferReaderRangeError(pos, 1, this.uint8.length - pos);
    }
    return this.uint8[pos]!;
  }

  seek(absolute: number): void {
    if (absolute < 0 || absolute > this.uint8.length) {
      throw new BufferReaderRangeError(absolute, 0, this.uint8.length);
    }
    this.pointer = absolute;
  }
}
