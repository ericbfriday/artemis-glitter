import { z } from "zod";

export const ConfigSchema = z.object({
  tcpPort: z.number().int().min(1).max(65535).default(3000),
  artemisServerAddr: z.string().nullable().default(null),
  playerShipIndex: z.number().int().min(0).max(7).default(0),
  headless: z.boolean().default(false),
  datDir: z.string().nullable().default(null),
});

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULTS: Config = {
  tcpPort: 3000,
  artemisServerAddr: null,
  playerShipIndex: 0,
  headless: false,
  datDir: null,
};

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const merged = { ...DEFAULTS, ...overrides };
  return ConfigSchema.parse(merged);
}

export function parseCliArgs(args: string[]): Partial<Config> {
  const config: Partial<Config> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--headless":
        config.headless = true;
        break;
      case "--server":
        config.artemisServerAddr = args[++i] ?? null;
        break;
      case "--port":
        config.tcpPort = Number.parseInt(args[++i] ?? "3000", 10);
        break;
      case "--dat-dir":
        config.datDir = args[++i] ?? null;
        break;
      case "--ship-index":
        config.playerShipIndex = Number.parseInt(args[++i] ?? "0", 10);
        break;
      case "--help":
        console.log(`Usage: artemis-glitter [options]

Options:
  --headless          Run without opening browser
  --server <addr>     Artemis server address (host:port)
  --port <port>       HTTP server port (default: 3000)
  --dat-dir <path>    Path to Artemis dat directory
  --ship-index <n>    Player ship index 0-7 (default: 0)
  --help              Show this help message`);
        process.exit(0);
    }
  }

  return config;
}

export function loadConfigFromEnv(env: Record<string, string | undefined>): Partial<Config> {
  const config: Partial<Config> = {};

  if (env.GLITTER_SERVER) config.artemisServerAddr = env.GLITTER_SERVER;
  if (env.GLITTER_PORT) config.tcpPort = Number.parseInt(env.GLITTER_PORT, 10);
  if (env.GLITTER_DAT_DIR) config.datDir = env.GLITTER_DAT_DIR;
  if (env.GLITTER_SHIP_INDEX) config.playerShipIndex = Number.parseInt(env.GLITTER_SHIP_INDEX, 10);
  if (env.GLITTER_HEADLESS === "true") config.headless = true;

  return config;
}
