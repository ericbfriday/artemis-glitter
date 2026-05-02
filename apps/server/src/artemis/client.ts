import { createConnection, type Socket } from "node:net";
import {
  FrameDecoder,
  PacketRegistry,
  BufferWriter,
  type EncodeResult,
} from "@artemis-glitter/protocol";
import type { ClientEvent, ConnectionState } from "./connectionState";

export class ArtemisClient {
  private socket: Socket | null = null;
  private state: ConnectionState = "idle";
  private decoder: FrameDecoder;
  private listeners: ((event: ClientEvent) => void)[] = [];

  constructor(
    private registry: PacketRegistry,
    private maxRetries = 3,
    private retryDelayMs = 2000,
  ) {
    this.decoder = new FrameDecoder(registry);
  }

  getState(): ConnectionState {
    return this.state;
  }

  onEvent(listener: (event: ClientEvent) => void): void {
    this.listeners.push(listener);
  }

  getListenerCount(): number {
    return this.listeners.length;
  }

  connect(host: string, port: number): void {
    if (this.state !== "idle" && this.state !== "failed" && this.state !== "retrying") {
      this.emit({ kind: "error", error: new Error(`Cannot connect from state: ${this.state}`) });
      return;
    }

    this.setState("connecting");

    const socket = createConnection({ host, port }, () => {
      this.setState("connected");
    });

    socket.on("data", (data: Buffer) => {
      const results = this.decoder.feed(new Uint8Array(data));
      for (const result of results) {
        if (result.kind === "packet") {
          this.emit({
            kind: "packet",
            name: result.header.type.toString(),
            payload: result.payload,
          });
        }
      }
    });

    socket.on("error", (err: Error) => {
      this.emit({ kind: "error", error: err });
    });

    socket.on("close", () => {
      if (this.state === "disconnecting") {
        this.setState("idle");
      } else if (this.state !== "failed") {
        this.setState("idle");
      }
    });

    this.socket = socket;
  }

  disconnect(): void {
    if (!this.socket) return;
    this.setState("disconnecting");
    this.socket.destroy();
    this.socket = null;
  }

  send(commandName: string, payload: Record<string, unknown>): EncodeResult {
    if (this.state !== "connected" || !this.socket) {
      return { kind: "error", reason: `Not connected (state: ${this.state})` };
    }

    const def = this.registry.getByName(commandName);
    if (!def || !def.encode) {
      return { kind: "error", reason: `Unknown or unencodable command: ${commandName}` };
    }

    const writer = new BufferWriter();
    const result = def.encode(writer, payload);
    if (result.kind === "ok" && this.socket) {
      this.socket.write(result.buffer);
    }

    return result;
  }

  private setState(newState: ConnectionState): void {
    const previous = this.state;
    this.state = newState;
    this.emit({ kind: "stateChange", detail: { previous, current: newState } });
  }

  private emit(event: ClientEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
