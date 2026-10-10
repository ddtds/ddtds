import { expect, test } from "vitest";
import { collect, fence, fixture } from "./test-utils.ts";

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
      "__doctests__/guide_md.test.ts",
      "__doctests__/nested_guide_md.test.ts",
      "unit.test.ts",
    ]
  `);
});

test("adds docs to the user's include", async () => {
  expect(await collect(fixture(files), {}, { include: ["**/*.check.ts"] })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md.test.ts",
      "__doctests__/nested_guide_md.test.ts",
      "unit.check.ts",
    ]
  `);
});

test("finds docs when the user sets test.dir", async () => {
  expect(await collect(fixture(files), {}, { dir: "tests" })).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md.test.ts",
      "__doctests__/nested_guide_md.test.ts",
    ]
  `);
});

test("passes include and exclude to findDocs", async () => {
  const plugin = { include: ["**/*.md"], exclude: ["nested/**"] };
  expect(await collect(fixture(files), plugin)).toMatchInlineSnapshot(`
    [
      "__doctests__/guide_md.test.ts",
      "unit.test.ts",
    ]
  `);
});
