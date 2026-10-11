import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { DocIndex } from "./docs.ts";
import { createLogger } from "./logger.ts";
import { typecheck } from "./typecheck.ts";

/** A project with TypeScript 6 installed and the given files */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ddtds-typecheck-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const typescript = dirname(createRequire(import.meta.url).resolve("typescript6/package.json"));
  mkdirSync(join(root, "node_modules"));
  symlinkSync(typescript, join(root, "node_modules/typescript"));
  for (const [file, content] of Object.entries(files)) writeFileSync(join(root, file), content);
  return root;
}

async function typeErrors(root: string, guide: string): Promise<string[]> {
  const index = DocIndex.fromSources(new Map([[join(root, "guide.md"), guide]]), {
    root,
    moduleDir: join(root, "__ddtds__"),
    logger: createLogger("silent"),
  });
  const errors = await typecheck(root, "export {};", index.fences());
  return [...errors.values()].map(({ message }) => message);
}

const guide = [
  "```ts run",
  'const count: number = "one";',
  "```",
  "",
  "```ts run",
  "const count: number = 1;",
  "```",
  "",
  "```js run",
  'const count = "not checked";',
  "```",
].join("\n");

test("reports type errors in TypeScript fences at their markdown position", async () => {
  expect(await typeErrors(project({}), guide)).toMatchInlineSnapshot(`
    [
      "guide.md:2:7 Type 'string' is not assignable to type 'number'. (ts block at line 1)",
    ]
  `);
});

test("uses the project's tsconfig", async () => {
  const untyped = "```ts run\nfunction double(x) {\n  return x * 2;\n}\n```\n";
  const loose = project({ "tsconfig.json": '{ "compilerOptions": { "strict": false } }' });
  expect(await typeErrors(project({}), untyped)).toMatchInlineSnapshot(`
    [
      "guide.md:2:17 Parameter 'x' implicitly has an 'any' type. (ts block at line 1)",
    ]
  `);
  expect(await typeErrors(loose, untyped)).toEqual([]);
});
