import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import type { ViteUserConfig } from "vitest/config";
import { createVitest } from "vitest/node";
import { ddtPlugin, type DdtPluginOptions } from "./index.ts";

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "ddtds-"));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "nested"));
  writeFileSync(join(dir, "guide.md"), "```ts run\n1;\n```\n");
  writeFileSync(join(dir, "nested/guide.md"), "```ts run\n1;\n```\n");
  writeFileSync(join(dir, "unit.test.ts"), "");
  writeFileSync(join(dir, "unit.check.ts"), "");
  return dir;
}

async function collect(
  root: string,
  plugin: DdtPluginOptions = {},
  test: ViteUserConfig["test"] = {},
): Promise<string[]> {
  const plugins = [ddtPlugin({ logLevel: "silent", ...plugin })];
  const vitest = await createVitest(
    "test",
    { root, config: false, watch: false },
    { plugins, test },
  );
  try {
    const specs = await vitest.globTestSpecifications();
    return specs.map((spec) => relative(root, spec.moduleId)).toSorted();
  } finally {
    await vitest.close();
  }
}

test("keeps vitest's default include when the user sets none", async () => {
  expect(await collect(fixture())).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md_1.test.ts",
      "__doctests__/nested_guide_md_1.test.ts",
      "unit.test.ts",
    ]
  `);
});

test("appends doc tests to the user's test include", async () => {
  expect(await collect(fixture(), {}, { include: ["**/*.check.ts"] })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md_1.test.ts",
      "__doctests__/nested_guide_md_1.test.ts",
      "unit.check.ts",
    ]
  `);
});

test("finds doc tests when the user sets test.dir", async () => {
  expect(await collect(fixture(), {}, { dir: "tests" })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md_1.test.ts",
      "__doctests__/nested_guide_md_1.test.ts",
    ]
  `);
});

test("passes include and exclude to findDocs", async () => {
  const plugin = { include: ["**/*.md"], exclude: ["nested/**"] };
  expect(await collect(fixture(), plugin)).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md_1.test.ts",
      "unit.test.ts",
    ]
  `);
});

test("collects tsrx doc tests", async () => {
  const root = fixture();
  writeFileSync(join(root, "guide.md"), "```tsrx run\n1;\n```\n");
  expect(await collect(root, { exclude: ["nested/**"] })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md_1.test.tsrx",
      "unit.test.ts",
    ]
  `);
});

test("resolves relative imports from the doc", async () => {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs/two.ts"), "export const two = 2;");
  writeFileSync(
    join(root, "docs/guide.md"),
    '```ts run\nimport { two } from "./two.ts";\nexpect(two).toBe(2);\n```\n',
  );
  const vitest = await createVitest(
    "test",
    { root, config: false, watch: false, reporters: [{}] },
    {
      plugins: [ddtPlugin({ logLevel: "silent" })],
      resolve: { alias: { "@ddtds/vitest": join(import.meta.dirname, "index.ts") } },
    },
  );
  try {
    await vitest.start();
    const states = vitest.state
      .getTestModules()
      .flatMap((module) => Array.from(module.children.allTests()))
      .map((testCase) => `${testCase.name} ${testCase.result().state}`);
    expect(states).toEqual(["docs/guide.md:1 passed"]);
  } finally {
    await vitest.close();
  }
});
