import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { expect, test } from "vitest";

function help(...args: string[]): string {
  const bin = fileURLToPath(new URL("index.ts", import.meta.url));
  // Force no-color so the help output is deterministic across environments
  // (cleye renders section titles differently depending on color support).
  const out = execFileSync(process.execPath, [bin, ...args, "--help"], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return stripVTControlCharacters(out);
}

test("ddt --help", () => {
  expect(help()).toMatchInlineSnapshot(`
    "ddt

    USAGE:
      ddt [flags...]
      ddt <command>

    COMMANDS:
      build        

    FLAGS:
      -h, --help        Show help

    "
  `);
});

test("ddt build --help", () => {
  expect(help("build")).toMatchInlineSnapshot(`
    "ddt build

    USAGE:
      ddt build [flags...] [include...]

    FLAGS:
          --exclude <string>        Glob of docs to skip, replaces default (default: ["**/node_modules/**","**/CHANGELOG.md"])
      -h, --help                    Show help
          --output <string>         Directory for generated test files (default: "__doctests__")

    "
  `);
});
