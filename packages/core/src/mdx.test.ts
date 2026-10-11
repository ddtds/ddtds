import { expect, test } from "vitest";
import { parseCodeFences } from "./blocks.ts";
import type { Logger } from "./logger.ts";

function ignore(): void {}

function capture(): { logger: Logger; errors: string[] } {
  const errors: string[] = [];
  return {
    errors,
    logger: { error: (m) => void errors.push(m), info: ignore, debug: ignore, trace: ignore },
  };
}

// A list inside a component: plain markdown ends the HTML block at the blank line and reads the
// indented fence as indented code, while MDX keeps the component's children as markdown
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

test("finds fences inside JSX components in MDX", () => {
  const { logger, errors } = capture();
  const blocks = parseCodeFences(steps, "guide.mdx", logger);
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
  expect(errors).toEqual([]);
});

test("reads invalid MDX as markdown and says why", () => {
  const { logger, errors } = capture();
  const source = "<Broken\n\n```ts run\nexpect(1).toBe(1);\n```\n";
  expect(parseCodeFences(source, "guide.mdx", logger).map(({ line }) => line)).toEqual([3]);
  expect(errors).toEqual([
    expect.stringMatching(/^guide\.mdx is not valid MDX, reading it as markdown: /),
  ]);
});
