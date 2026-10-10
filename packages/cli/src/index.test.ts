import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { expect, onTestFinished, test } from "vitest";
import { createVitest } from "vitest/node";

function ddt(cwd: string, ...args: string[]): string {
  const bin = fileURLToPath(new URL("index.ts", import.meta.url));
  // Force no-color so the help output is deterministic across environments
  // (cleye renders section titles differently depending on color support).
  const out = execFileSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return stripVTControlCharacters(out);
}

function fixture(markdown: string): string {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "guide.md"), markdown);
  return root;
}

const guide = "```ts run\nexpect(1).toBe(1);\n```\n\n```tsx fail\nthrow new Error();\n```\n";

test("ddt --help", () => {
  expect(ddt(".", "--help")).toMatchInlineSnapshot(`
    "ddt

    USAGE:
      ddt [flags...]
      ddt <command>

    COMMANDS:
      build        
      list         

    FLAGS:
      -h, --help        Show help

    "
  `);
});

test("ddt build --help", () => {
  expect(ddt(".", "build", "--help")).toMatchInlineSnapshot(`
    "ddt build

    USAGE:
      ddt build [flags...] [include...]

    FLAGS:
          --exclude <string>        Glob of docs to skip, replaces default (default: ["**/node_modules/**","**/CHANGELOG.md"])
      -h, --help                    Show help
          --out-dir <string>        Directory for generated test files (default: "__doctests__")

    "
  `);
});

test("ddt list --help", () => {
  expect(ddt(".", "list", "--help")).toMatchInlineSnapshot(`
    "ddt list

    USAGE:
      ddt list [flags...] [include...]

    FLAGS:
          --exclude <string>        Glob of docs to skip, replaces default (default: ["**/node_modules/**","**/CHANGELOG.md"])
      -h, --help                    Show help
          --json                    Print as JSON
          --out-dir <string>        Directory for generated test files (default: "__doctests__")

    "
  `);
});

test("ddt list --json", () => {
  expect(JSON.parse(ddt(fixture(guide), "list", "--json"))).toMatchInlineSnapshot(`
    [
      {
        "annotation": "run",
        "file": "guide.md",
        "lang": "ts",
        "line": 1,
        "module": "__doctests__/guide_md_1.ts",
      },
      {
        "annotation": "fail",
        "file": "guide.md",
        "lang": "tsx",
        "line": 5,
        "module": "__doctests__/guide_md_5.tsx",
      },
    ]
  `);
});

test("ddt build writes modules that vitest runs without the plugin", async () => {
  const root = fixture(guide);
  ddt(root, "build");
  expect(readdirSync(join(root, "__doctests__")).toSorted()).toMatchInlineSnapshot(`
    [
      "guide_md.test.ts",
      "guide_md_1.ts",
      "guide_md_5.tsx",
    ]
  `);

  const vitest = await createVitest("test", { root, config: false, watch: false, reporters: [{}] });
  // vitest v4 does not make vitest a Disposable
  await using _ = { [Symbol.asyncDispose]: () => vitest.close() };
  await vitest.start();
  const states = vitest.state
    .getTestModules()
    .flatMap((module) => Array.from(module.children.allTests()))
    .map((testCase) => `${testCase.name} ${testCase.result().state}`);
  expect(states).toMatchInlineSnapshot(`
    [
      "guide.md:1 passed",
      "guide.md:5 passed",
    ]
  `);
});
