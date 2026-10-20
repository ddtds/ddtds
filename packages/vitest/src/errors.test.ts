import { expect, test } from "vitest";
import { ANNOTATIONS } from "@ddtds/core";
import { fence, fixture, spawn } from "@ddtds/test-utils";
import { failures } from "./test-utils.ts";
import { vitest } from "./e2e.ts";

test("failures report the error the fence threw", async () => {
  await using dir = fixture({
    "guide.md": `# Guide\n\n${fence("const a = 1;\nexpect(a).toBe(2);")}${fence('throw new TypeError("boom");')}`,
  });
  expect(await failures(dir.root)).toMatchInlineSnapshot(`
    {
      "guide.md:3": {
        "diff": "- Expected
    + Received

    - 2
    + 1",
        "error": "AssertionError: expected 1 to be 2 // Object.is equality",
        "frames": [
          "guide.md:5:11",
        ],
      },
      "guide.md:8": {
        "diff": undefined,
        "error": "TypeError: boom",
        "frames": [
          "guide.md:9:7",
        ],
      },
    }
  `);
});

test("compile failures point at the markdown", async () => {
  await using dir = fixture({
    "guide.md": `# Guide\n\n${fence("const ok = 1;\nconst = 1;")}${fence("1;", ANNOTATIONS.COMPILE_FAIL)}`,
  });
  expect(await failures(dir.root)).toMatchInlineSnapshot(`
    {
      "guide.md:3": {
        "diff": undefined,
        "error": "DdtCompileError: guide.md:5:7 Unexpected token (ts block at line 3)",
        "frames": [
          "guide.md:5:7",
        ],
      },
      "guide.md:8": {
        "diff": undefined,
        "error": "Error: expected a compile_fail block to fail to compile",
        "frames": [
          "guide.md:8:1",
        ],
      },
    }
  `);
});

test("invalid MDX fails the run with the parser's error", async () => {
  await using ddt = spawn(vitest(), {
    "broken.mdx": "# Guide\n\n<!-- TODO: explain -->\n\n```ts run\nexpect(1).toBe(1);\n```\n",
    "fine.md": fence("expect(1).toBe(1);"),
  });
  await expect(ddt.run()).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: 3:1: Unexpected character \`!\` (U+0021) before name, expected a character that can start a name, such as a letter, \`$\`, or \`_\` (note: to create a comment in MDX, use \`{/* text */}\`) (mdx-jsx:unexpected-character)]`,
  );
});
