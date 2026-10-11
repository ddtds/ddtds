import { expect, test } from "vitest";
import { parseCodeFences } from "./blocks.ts";

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
  const blocks = parseCodeFences(steps, "guide.mdx");
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
