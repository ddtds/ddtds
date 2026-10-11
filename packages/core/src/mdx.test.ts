import { expect, test } from "vitest";
import { parseCodeFences } from "./blocks.ts";
import { createLogger } from "./logger.ts";

const silent = createLogger("silent");

test("finds fences inside JSX components in MDX", () => {
  const steps = [
    "<Steps>",
    "1. Add a check:",
    "",
    "    ```ts run",
    "    expect(1).toBe(1);",
    "    ```",
    "</Steps>",
    "",
  ].join("\n");
  const blocks = parseCodeFences(steps, "guide.mdx", silent);
  expect(
    blocks.map(({ line, details }) => ({ line, indent: details.indent, code: details.contents })),
  ).toMatchInlineSnapshot(`
    [
      {
        "code": "expect(1).toBe(1);",
        "indent": 4,
        "line": 4,
      },
    ]
  `);
});

test("rejects invalid MDX, naming the doc", () => {
  const source = "<Broken\n\n```ts run\nexpect(1).toBe(1);\n```\n";
  expect(() => parseCodeFences(source, "guide.mdx", silent)).toThrow(
    new Error("guide.mdx is not valid MDX"),
  );
});
