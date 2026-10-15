import { expect, test } from "vitest";
import { spawn } from "@ddtds/test-utils";
import { nodeTest } from "./e2e.ts";

test("only the file node starts with registers its JSDoc fences", async () => {
  const documented = [
    "/**",
    " * ```ts run",
    " * assert.equal(1, 1);",
    " * ```",
    " */",
    "export {};",
    "",
  ];
  await using ddt = spawn(
    nodeTest,
    {
      "entry.ts": 'import "./imported.ts";\n',
      "imported.ts": documented.join("\n"),
      "own.ts": documented.join("\n"),
    },
    { docs: ["entry.ts", "own.ts"] },
  );
  expect(await ddt.run()).toEqual({ "own.ts:2": "passed" });
});
