import { expect, test } from "vitest";
import { greet } from "../src/index.tsx";

test("greets by name", () => {
  expect(greet("Ada")).toBe("Hello, Ada!");
});
