import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import type { ViteUserConfig } from "vitest/config";
import { createVitest } from "vitest/node";
import { ddtPlugin, defaultDocsExclude, type DdtPluginOptions } from "./index.ts";

async function collectTestFiles({
  root = ".",
  test = {},
  plugin = {},
}: {
  root?: string;
  test?: ViteUserConfig["test"];
  plugin?: DdtPluginOptions;
} = {}): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), "ddtds-"));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "nested"));
  for (const doc of ["guide.md", "nested/guide.md", "CHANGELOG.md"]) {
    writeFileSync(join(dir, doc), "```ts run\n1;\n```\n");
  }
  for (const unit of ["unit.test.ts", "unit.check.ts"]) writeFileSync(join(dir, unit), "");

  const vitestRoot = join(dir, root);
  const vitest = await createVitest(
    "test",
    { root: vitestRoot, config: false, watch: false },
    { plugins: [ddtPlugin({ logLevel: "silent", ...plugin })], test },
  );
  try {
    const specs = await vitest.globTestSpecifications();
    return specs.map((spec) => relative(vitestRoot, spec.moduleId)).toSorted();
  } finally {
    await vitest.close();
  }
}

test("keeps vitest's default include when the user sets none", async () => {
  expect(await collectTestFiles()).toMatchInlineSnapshot(`
    [
      "__doctests__/guide.md_1.test.ts",
      "__doctests__/nested_guide.md_1.test.ts",
      "unit.test.ts",
    ]
  `);
});

test("appends doc tests to the user's include", async () => {
  expect(await collectTestFiles({ test: { include: ["**/*.check.ts"] } })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide.md_1.test.ts",
      "__doctests__/nested_guide.md_1.test.ts",
      "unit.check.ts",
    ]
  `);
});

test("finds doc tests when the user sets test.dir", async () => {
  expect(await collectTestFiles({ test: { dir: "tests" } })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide.md_1.test.ts",
      "__doctests__/nested_guide.md_1.test.ts",
    ]
  `);
});

test("only tests docs matching include", async () => {
  expect(await collectTestFiles({ plugin: { include: ["nested/*.md"] } })).toMatchInlineSnapshot(`
    [
      "__doctests__/nested_guide.md_1.test.ts",
      "unit.test.ts",
    ]
  `);
});

test("tests docs outside the vitest root", async () => {
  expect(await collectTestFiles({ root: "nested", plugin: { include: ["../*.md"] } }))
    .toMatchInlineSnapshot(`
    [
      "__doctests__/___guide.md_1.test.ts",
    ]
  `);
});

test("skips docs matching exclude", async () => {
  const exclude = [...defaultDocsExclude, "nested/**"];
  expect(await collectTestFiles({ plugin: { exclude } })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide.md_1.test.ts",
      "unit.test.ts",
    ]
  `);
});
