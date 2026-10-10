import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { collect, fence, fixture, run, watch } from "./test-utils.ts";

const files = {
  "guide.md": fence("1;"),
  "nested/guide.md": fence("1;"),
  "prose.md": "# no code to run\n",
  "unit.test.ts": "",
  "unit.check.ts": "",
};

test("adds docs with runnable code to vitest's default include", async () => {
  expect(await collect(fixture(files))).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
      "unit.test.ts",
    ]
  `);
});

test("adds docs to the user's include", async () => {
  expect(await collect(fixture(files), {}, { include: ["**/*.check.ts"] })).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
      "unit.check.ts",
    ]
  `);
});

test("finds docs when the user sets test.dir", async () => {
  expect(await collect(fixture(files), {}, { dir: "tests" })).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
    ]
  `);
});

test("passes include and exclude to findDocs", async () => {
  const plugin = { include: ["**/*.md"], exclude: ["nested/**"] };
  expect(await collect(fixture(files), plugin)).toMatchInlineSnapshot(`
    [
      "guide.md",
      "unit.test.ts",
    ]
  `);
});

test("ignores stale files from ddt build", async () => {
  const root = fixture({ ...files, "__doctests__/stale.test.ts": "" });
  expect(await collect(root)).not.toContain("__doctests__/stale.test.ts");
});

test("resolves packages from the root for docs outside it", async () => {
  const root = fixture({
    "pkg/node_modules/local-dep/package.json": '{ "name": "local-dep", "main": "index.js" }',
    "pkg/node_modules/local-dep/index.js": "export const one = 1;",
    "docs/guide.md": fence('import { one } from "local-dep";\nexpect(one).toBe(1);'),
  });
  expect(await run(join(root, "pkg"), { include: ["../docs/*.md"] })).toEqual({
    "../docs/guide.md:1": "passed",
  });
});

test("reruns a doc when it is edited in watch mode", async () => {
  const root = fixture({ "guide.md": fence("expect(1).toBe(1);") });
  const edit = () => writeFileSync(join(root, "guide.md"), fence("expect(1).toBe(2);"));
  expect(await watch(root, edit)).toMatchInlineSnapshot(`
    [
      {
        "guide.md:1": "passed",
      },
      {
        "guide.md:1": "runtime-failure",
      },
    ]
  `);
});

test("keeps the user's test.exclude and still skips ddt build output", async () => {
  const root = fixture({ ...files, "__doctests__/stale.test.ts": "" });
  expect(await collect(root, {}, { exclude: ["unit.test.ts"] })).toMatchInlineSnapshot(`
    [
      "guide.md",
      "nested/guide.md",
    ]
  `);
});
