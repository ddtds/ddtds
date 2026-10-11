import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { failures, fence, fixture as files, run, watch } from "./test-utils.ts";

/** A fixture with TypeScript 6 installed, as a project using typecheck would have */
function fixture(contents: Record<string, string>): string {
  const root = files(contents);
  const typescript = dirname(createRequire(import.meta.url).resolve("typescript6/package.json"));
  mkdirSync(join(root, "node_modules"), { recursive: true });
  symlinkSync(typescript, join(root, "node_modules/typescript"));
  return root;
}

const guide = [
  "# Guide",
  "",
  fence('const count: number = "one";\nexpect(count).toBe("one");'),
  fence("const count: number = 1;\nexpect(count).toBe(1);"),
  fence("const name: string = 1;", "compile_fail"),
].join("\n");

test("type errors only fail fences when typecheck is on", async () => {
  const root = fixture({ "guide.md": guide });
  expect(await run(root)).toMatchInlineSnapshot(`
    {
      "guide.md:15": "Error",
      "guide.md:3": "passed",
      "guide.md:9": "passed",
    }
  `);
  expect(await run(root, { typecheck: true })).toMatchInlineSnapshot(`
    {
      "guide.md:15": "passed",
      "guide.md:3": "DdtCompileError",
      "guide.md:9": "passed",
    }
  `);
});

test("type errors point at the markdown", async () => {
  const root = fixture({ "guide.md": guide });
  expect(await failures(root, { typecheck: true })).toMatchInlineSnapshot(`
    {
      "guide.md:3": {
        "diff": undefined,
        "error": "DdtCompileError: guide.md:4:7 Type 'string' is not assignable to type 'number'. (ts block at line 3)",
        "frames": [
          "__ddtds__/guide_md_3.ts:4",
        ],
      },
    }
  `);
});

test("uses the project's tsconfig", async () => {
  const untyped = fence("function double(x) {\n  return x * 2;\n}\nexpect(double(2)).toBe(4);");
  const loose = {
    "tsconfig.json": '{ "compilerOptions": { "strict": false } }',
    "guide.md": untyped,
  };
  expect(await run(fixture({ "guide.md": untyped }), { typecheck: true })).toMatchInlineSnapshot(`
    {
      "guide.md:1": "DdtCompileError",
    }
  `);
  expect(await run(fixture(loose), { typecheck: true })).toMatchInlineSnapshot(`
    {
      "guide.md:1": "passed",
    }
  `);
});

test("rechecks types when a doc is edited in watch mode", async () => {
  const root = fixture({ "guide.md": fence("const count: number = 1;") });
  const edit = () => writeFileSync(join(root, "guide.md"), fence('const count: number = "one";'));
  expect(await watch(root, edit, { typecheck: true })).toMatchInlineSnapshot(`
    [
      {
        "guide.md:1": "passed",
      },
      {
        "guide.md:1": "DdtCompileError",
      },
    ]
  `);
});

test("explains that TypeScript 7 has no compiler API yet", async () => {
  // Without its own TypeScript, the fixture resolves this repo's TypeScript 7
  const root = files({ "guide.md": fence("const count: number = 1;") });
  const errors = Object.values(await failures(root, { typecheck: true })).map(({ error }) => error);
  expect(errors.join("\n")).toContain("typecheck needs TypeScript 5 or 6 for its compiler API");
});
