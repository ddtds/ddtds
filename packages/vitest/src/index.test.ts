import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { createVitest } from "vitest/node";
import { ddtPlugin } from "./index.ts";

async function collectTestFiles(include?: string[]): Promise<string[]> {
  const root = mkdtempSync(join(tmpdir(), "ddtds-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "guide.md"), "```ts run\n1;\n```\n");
  writeFileSync(join(root, "unit.test.ts"), "");
  writeFileSync(join(root, "unit.check.ts"), "");

  const vitest = await createVitest(
    "test",
    { root, config: false, watch: false },
    {
      plugins: [ddtPlugin(root, join(root, "__doctests__"), { logLevel: "silent" })],
      test: { include },
    },
  );
  try {
    const specs = await vitest.globTestSpecifications();
    return specs.map((spec) => relative(root, spec.moduleId)).toSorted();
  } finally {
    await vitest.close();
  }
}

test("keeps vitest's default include when the user sets none", async () => {
  expect(await collectTestFiles()).toMatchInlineSnapshot(`
    [
      "__doctests__/guide.md_1.test.ts",
      "unit.test.ts",
    ]
  `);
});

test("appends doc tests to the user's include", async () => {
  expect(await collectTestFiles(["**/*.check.ts"])).toMatchInlineSnapshot(`
    [
      "__doctests__/guide.md_1.test.ts",
      "unit.check.ts",
    ]
  `);
});
