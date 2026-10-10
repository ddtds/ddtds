import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { expect, test } from "vitest";

function help(...args: string[]): string {
  const bin = fileURLToPath(new URL("index.ts", import.meta.url));
  const out = execFileSync(process.execPath, [bin, ...args, "--help"], { encoding: "utf8" });
  return stripVTControlCharacters(out);
}

test("ddt --help", () => {
  expect(help()).toMatchInlineSnapshot(`
    "ddt

    Usage:
      ddt [flags...]
      ddt <command>

    Commands:
      build        

    Flags:
      -h, --help        Show help

    "
  `);
});

test("ddt build --help", () => {
  expect(help("build")).toMatchInlineSnapshot(`
    "ddt build

    Usage:
      ddt build [flags...] [include...] (default: **/*.{md,mdx})

    Flags:
          --exclude <string>        Glob of docs to skip, replaces default (default: **/node_modules/**, **/CHANGELOG.md)
      -h, --help                    Show help
          --output <string>         Directory for generated test files (default: __doctests__)

    "
  `);
});
