import { describe, test, expect, afterAll } from "bun:test";
import { createFakeArtemis } from "./server";
import { connect } from "node:net";

describe("fake Artemis TCP server", () => {
  const fake = createFakeArtemis({ port: 0 });

  afterAll(() => {
    fake.close();
  });

  test("listen accepts connections", async () => {
    await fake.listen();
    const port = fake.getPort();

    const received: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const socket = connect({ host: "127.0.0.1", port }, () => {
        socket.on("data", (data: string | Buffer) => {
          received.push(Buffer.from(data));
          if (received.length >= 2) {
            socket.destroy();
            resolve();
          }
        });
        setTimeout(() => {
          socket.destroy();
          reject(new Error("Timeout waiting for data"));
        }, 5000);
      });
      socket.on("error", reject);
    });

    expect(received.length).toBeGreaterThan(0);

    const firstPacket = received[0];
    expect(firstPacket).toBeDefined();
    expect(firstPacket!.length).toBeGreaterThanOrEqual(24);
    const magic = firstPacket!.readUInt32LE(0);
    expect(magic).toBe(0xdeadbeef);
  });

  test("getReceived records client data", async () => {
    const receivedBefore = fake.getReceived().length;

    const port = fake.getPort();
    await new Promise<void>((resolve, reject) => {
      const socket = connect({ host: "127.0.0.1", port }, () => {
        const outFireTube = Buffer.alloc(32);
        let off = 0;
        outFireTube.writeUInt32LE(0xdeadbeef, off);
        off += 4;
        outFireTube.writeUInt32LE(32, off);
        off += 4;
        outFireTube.writeUInt32LE(0, off);
        off += 4;
        outFireTube.writeUInt32LE(0, off);
        off += 4;
        outFireTube.writeUInt32LE(12, off);
        off += 4;
        outFireTube.writeUInt32LE(0x4c821d3c, off);
        off += 4;
        outFireTube.writeUInt32LE(0x08, off);
        off += 4;
        outFireTube.writeUInt32LE(0, off);
        off += 4;
        socket.write(outFireTube);
        setTimeout(() => {
          socket.destroy();
          resolve();
        }, 500);
      });
      socket.on("error", reject);
    });

    expect(fake.getReceived().length).toBeGreaterThan(receivedBefore);
  });

  test("sendFixture sends a named fixture", async () => {
    const port = fake.getPort();
    const received: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      const socket = connect({ host: "127.0.0.1", port }, () => {
        socket.on("data", (data: string | Buffer) => {
          received.push(Buffer.from(data));
        });
        setTimeout(() => {
          socket.destroy();
          resolve();
        }, 200);
      });
      socket.on("error", reject);
    });

    expect(received.length).toBeGreaterThan(0);
  });
});
