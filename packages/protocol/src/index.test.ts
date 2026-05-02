import { describe, test, expect } from "bun:test";
import { PACKAGE_NAME } from "./index";

describe("workspace smoke test", () => {
  test("protocol package exports its name", () => {
    expect(PACKAGE_NAME).toBe("@artemis-glitter/protocol");
  });
});
