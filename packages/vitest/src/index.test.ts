import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { fence, fixture } from "@ddtds/test-utils";
import { collect, create, logs } from "./test-utils.ts";
import { vitest } from "./e2e.ts";

const files = {
  "guide.md": fence("1;"),
  "nested/guide.md": fence("1;"),
  "prose.md": "# no code to run\n",
  "unit.test.ts": "",
  "unit.check.ts": "",
};

test("adds docs with runnable code to vitest's default include", async () => {
  await using dir = fixture(files);
  expect(await collect(dir.root)).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
      "unit.test.ts",
    ]
  `);
});

test("adds docs to the user's include", async () => {
  await using dir = fixture(files);
  expect(await collect(dir.root, {}, { include: ["**/*.check.ts"] })).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
      "unit.check.ts",
    ]
  `);
});

test("finds docs when the user sets test.dir", async () => {
  await using dir = fixture(files);
  expect(await collect(dir.root, {}, { dir: "tests" })).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
    ]
  `);
});

test("passes include and exclude to findDocs", async () => {
  await using dir = fixture(files);
  const plugin = { include: ["**/*.md"], exclude: ["nested/**"] };
  expect(await collect(dir.root, plugin)).toMatchInlineSnapshot(`
    [
      "guide.md",
      "unit.test.ts",
    ]
  `);
});

test("ignores stale files from ddt build", async () => {
  await using dir = fixture({ ...files, "__doctests__/stale.test.ts": "" });
  expect(await collect(dir.root)).not.toContain("__doctests__/stale.test.ts");
});

test("resolves packages from the root for docs outside it", async () => {
  await using dir = fixture({
    "pkg/node_modules/local-dep/package.json": '{ "name": "local-dep", "main": "index.js" }',
    "pkg/node_modules/local-dep/index.js": "export const one = 1;",
    "docs/guide.md": fence('import { one } from "local-dep";\nexpect(one).toBe(1);'),
  });
  const { outcomes } = await vitest().run(join(dir.root, "pkg"), ["../docs/guide.md"]);
  expect(outcomes).toEqual({ "../docs/guide.md:1": "passed" });
});

test("refreshes a changed doc before loading its test module again", async () => {
  await using dir = fixture({ "guide.md": fence("expect(1).toBe(1);") });
  await using instance = await create(dir.root, { plugin: { include: ["guide.md"] } });

  const doc = join(dir.root, "guide.md");
  const id = `${doc}?ddtds`;
  const before = await instance.vite.pluginContainer.load(id);
  writeFileSync(doc, fence("expect(1).toBe(2);"));

  expect(await instance.vite.pluginContainer.load(id)).not.toEqual(before);
});

test("keeps the user's test.exclude and still skips ddt build output", async () => {
  await using dir = fixture({ ...files, "__doctests__/stale.test.ts": "" });
  expect(await collect(dir.root, {}, { exclude: ["unit.test.ts"] })).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
    ]
  `);
});

test("logs through Vite's logger, which Vitest keeps at warn unless configured", async () => {
  await using dir = fixture({
    "guide.md": fence("expect(1).toBe(1);"),
    "bad.md": "```ts run fail\n1;\n```\n",
  });
  expect(await logs(dir.root, { logLevel: "info" })).toMatchInlineSnapshot(`
    [
      "stderr: [ddtds] unknown annotation in code block: "run fail"",
    ]
  `);
  expect(await logs(dir.root, { logLevel: "info" }, "info")).toMatchInlineSnapshot(`
    [
      "stderr: [ddtds] unknown annotation in code block: "run fail"",
      "stdout: [ddtds] Total: 1 tests",
    ]
  `);
  expect(await logs(dir.root, { logLevel: "error" }, "info")).toMatchInlineSnapshot(`
    [
      "stderr: [ddtds] unknown annotation in code block: "run fail"",
    ]
  `);
});

const globalsFiles = {
  "expect.md": fence("expect(1).toBe(1);"),
  "vi.md": fence("expect(typeof vi.fn).toBe('function');"),
  "describe.md": fence("expect(typeof describe).toBe('function');"),
  "reimports.md": fence(
    "import { describe, expect, vi } from 'vitest';\nexpect(typeof describe).toBe('function');",
  ),
};

test.each([
  {
    globals: "off",
    project: false,
    expect: "ReferenceError",
    vi: "ReferenceError",
    describe: "ReferenceError",
  },
  {
    globals: "minimal",
    project: false,
    expect: "passed",
    vi: "passed",
    describe: "AssertionError",
  },
  { globals: "full", project: false, expect: "passed", vi: "passed", describe: "passed" },
  { globals: "off", project: true, expect: "passed", vi: "passed", describe: "passed" },
  { globals: "minimal", project: true, expect: "passed", vi: "passed", describe: "passed" },
  { globals: "full", project: true, expect: "passed", vi: "passed", describe: "passed" },
] as const)(
  "globals $globals, project globals $project",
  async ({ globals, project, ...expected }) => {
    await using dir = fixture(globalsFiles);
    const { outcomes } = await vitest({ plugin: { globals }, test: { globals: project } }).run(
      dir.root,
      Object.keys(globalsFiles),
    );
    expect(outcomes).toEqual({
      "expect.md:1": expected.expect,
      "vi.md:1": expected.vi,
      "describe.md:1": expected.describe,
      "reimports.md:1": "passed",
    });
  },
);

test.each([
  { globals: "full", warns: true },
  { globals: "minimal", warns: false },
  { globals: "off", warns: false },
] as const)(
  "globals $globals warns $warns when the project enables globals",
  async ({ globals, warns }) => {
    await using dir = fixture(globalsFiles);
    const warnings = await logs(dir.root, { globals, logLevel: "info" }, undefined, {
      globals: true,
    });
    expect(warnings).toEqual(
      warns
        ? [
            'stderr: [ddtds] `globals: "full"` has no effect, vitest `test.globals` is already enabled',
          ]
        : [],
    );
  },
);
