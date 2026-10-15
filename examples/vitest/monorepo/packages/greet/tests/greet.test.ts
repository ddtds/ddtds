import { expect, test } from "vitest";
import { greet } from "../src/index.ts";

test("greets by name", () => {
  expect(greet("Ada")).toBe("Hello, Ada!");
});
