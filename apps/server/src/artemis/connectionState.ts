export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "retrying"
  | "failed";

export interface ConnectionStateEvent {
  previous: ConnectionState;
  current: ConnectionState;
}

export type ClientEvent =
  | { kind: "stateChange"; detail: ConnectionStateEvent }
  | { kind: "packet"; name: string; payload: unknown }
  | { kind: "error"; error: Error };
