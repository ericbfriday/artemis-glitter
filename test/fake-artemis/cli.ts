import { createFakeArtemis } from "./server";

const port = parseInt(
  process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? "12010",
  10,
);
const script = process.argv.find((a) => a.startsWith("--script="))?.split("=")[1] ?? "default";

const fake = createFakeArtemis({ port, script });

fake.listen();

process.on("SIGINT", () => {
  fake.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  fake.close();
  process.exit(0);
});
