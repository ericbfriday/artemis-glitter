import type { Server, Socket } from "node:net";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "..", "fixtures", "packets");

type FakeArtemisOptions = {
  port?: number;
  script?: string;
};

type TimelineEntry = {
  fixture: string;
  delay: number;
  waitFor?: string;
};

export type FakeArtemis = {
  listen: () => Promise<void>;
  close: () => void;
  getReceived: () => Buffer[];
  sendFixture: (name: string) => void;
  getPort: () => number;
};

function loadFixture(name: string): Buffer {
  return readFileSync(resolve(FIXTURES_DIR, `${name}.bin`));
}

export const SCRIPTS: Record<string, TimelineEntry[]> = {
  default: [
    { fixture: "welcome", delay: 0 },
    { fixture: "version", delay: 50 },
    { fixture: "allShipSettings", delay: 50 },
    { fixture: "playerUpdate", delay: 200 },
    { fixture: "weaponsUpdate", delay: 1000 },
    { fixture: "gameOverReason", delay: 0, waitFor: "fireTube" },
  ],
};

export function createFakeArtemis(opts: FakeArtemisOptions = {}): FakeArtemis {
  const requestedPort = opts.port ?? 12010;
  const scriptName = opts.script ?? "default";
  const timeline = SCRIPTS[scriptName] ?? SCRIPTS["default"]!;

  const received: Buffer[] = [];
  let server: Server;
  let actualPort = requestedPort;
  let activeSocket: Socket | null = null;
  let waitingFor: string | null = null;
  let pendingTimers: ReturnType<typeof setTimeout>[] = [];

  const fireTubeType = 0x4c821d3c;
  const fireTubeSubtype = 0x08;

  function detectPacketType(buf: Buffer): string | null {
    if (buf.length < 24) return null;
    const type = buf.readUInt32LE(20);
    if (type === fireTubeType && buf.length >= 28) {
      const subtype = buf.readUInt32LE(24);
      if (subtype === fireTubeSubtype) return "fireTube";
    }
    return null;
  }

  function runTimeline(socket: Socket) {
    for (const entry of timeline) {
      const timer = setTimeout(() => {
        if (entry.waitFor) {
          waitingFor = entry.waitFor;
          return;
        }
        try {
          socket.write(loadFixture(entry.fixture));
        } catch {
          // socket may have closed
        }
      }, entry.delay);
      pendingTimers.push(timer);
    }
  }

  function handleData(buf: Buffer) {
    received.push(buf);

    const detected = detectPacketType(buf);
    if (waitingFor && detected === waitingFor) {
      waitingFor = null;
      const nextFixture = timeline.find((e) => e.waitFor === detected);
      if (nextFixture) {
        try {
          activeSocket?.write(loadFixture(nextFixture.fixture));
        } catch {
          // socket may have closed
        }
      }
    }
  }

  return {
    listen: () =>
      new Promise((resolvePromise) => {
        server = createServer((socket) => {
          activeSocket = socket;
          socket.on("data", handleData);
          socket.on("error", () => {});
          runTimeline(socket);
        });
        server.listen(requestedPort, () => {
          actualPort = (server.address() as { port: number }).port;
          resolvePromise();
        });
      }),

    close: () => {
      pendingTimers.forEach(clearTimeout);
      pendingTimers = [];
      activeSocket?.destroy();
      activeSocket = null;
      server?.close();
    },

    getReceived: () => [...received],

    sendFixture: (name: string) => {
      activeSocket?.write(loadFixture(name));
    },

    getPort: () => actualPort,
  };
}
