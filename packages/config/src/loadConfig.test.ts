import { describe, test, expect } from "bun:test";
import { loadConfig, parseCliArgs, loadConfigFromEnv, ConfigSchema } from "./loadConfig";

describe("ConfigSchema", () => {
  test("rejects invalid playerShipIndex", () => {
    expect(() => ConfigSchema.parse({ playerShipIndex: 8 })).toThrow();
    expect(() => ConfigSchema.parse({ playerShipIndex: -1 })).toThrow();
  });

  test("rejects invalid tcpPort", () => {
    expect(() => ConfigSchema.parse({ tcpPort: 0 })).toThrow();
    expect(() => ConfigSchema.parse({ tcpPort: 70000 })).toThrow();
  });

  test("applies defaults", () => {
    const config = loadConfig();
    expect(config.tcpPort).toBe(3000);
    expect(config.headless).toBe(false);
    expect(config.artemisServerAddr).toBeNull();
  });
});

describe("loadConfig", () => {
  test("merges overrides onto defaults", () => {
    const config = loadConfig({ tcpPort: 8080, headless: true });
    expect(config.tcpPort).toBe(8080);
    expect(config.headless).toBe(true);
    expect(config.playerShipIndex).toBe(0);
  });
});

describe("parseCliArgs", () => {
  test("parses --headless flag", () => {
    const result = parseCliArgs(["--headless"]);
    expect(result.headless).toBe(true);
  });

  test("parses --server with value", () => {
    const result = parseCliArgs(["--server", "192.168.1.100:2010"]);
    expect(result.artemisServerAddr).toBe("192.168.1.100:2010");
  });

  test("parses --port with value", () => {
    const result = parseCliArgs(["--port", "8080"]);
    expect(result.tcpPort).toBe(8080);
  });

  test("parses --ship-index with value", () => {
    const result = parseCliArgs(["--ship-index", "3"]);
    expect(result.playerShipIndex).toBe(3);
  });

  test("parses --dat-dir with value", () => {
    const result = parseCliArgs(["--dat-dir", "/opt/artemis/dat"]);
    expect(result.datDir).toBe("/opt/artemis/dat");
  });
});

describe("loadConfigFromEnv", () => {
  test("reads GLITTER_SERVER", () => {
    const result = loadConfigFromEnv({ GLITTER_SERVER: "10.0.0.1:2010" });
    expect(result.artemisServerAddr).toBe("10.0.0.1:2010");
  });

  test("reads GLITTER_PORT", () => {
    const result = loadConfigFromEnv({ GLITTER_PORT: "9000" });
    expect(result.tcpPort).toBe(9000);
  });

  test("reads GLITTER_HEADLESS", () => {
    const result = loadConfigFromEnv({ GLITTER_HEADLESS: "true" });
    expect(result.headless).toBe(true);
  });

  test("ignores unset env vars", () => {
    const result = loadConfigFromEnv({});
    expect(result).toEqual({});
  });
});
