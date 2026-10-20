import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const bin = fileURLToPath(new URL("../dist/index.mjs", import.meta.url));

function help(...args: string[]): string {
  return execFileSync(process.execPath, [bin, ...args, "--help"], { encoding: "utf8" });
}

function build(level?: string): { stdout: string; stderr: string } {
  const cwd = mkdtempSync(join(tmpdir(), "ddtds-cli-"));
  writeFileSync(join(cwd, "guide.md"), "```ts run\n1;\n```\n");
  writeFileSync(join(cwd, "bad.md"), "```ts run fail\n1;\n```\n");
  const env = { ...process.env, DDT_LOG_LEVEL: level };
  const { stdout, stderr } = spawnSync(process.execPath, [bin, "build"], {
    cwd,
    env,
    encoding: "utf8",
  });
  return { stdout, stderr };
}

test("ddt build logs the total to stdout and problems to stderr", () => {
  expect(build()).toMatchInlineSnapshot(`
    {
      "stderr": "code block has more than one annotation: run, fail
    ",
      "stdout": "Total: 1 tests
    ",
    }
  `);
});

test("DDT_LOG_LEVEL=fatal logs nothing", () => {
  expect(build("fatal")).toMatchInlineSnapshot(`
    {
      "stderr": "",
      "stdout": "",
    }
  `);
});

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
          --exclude <string>        Glob of docs to skip, replaces default (default: ["**/node_modules/**","**/CHANGELOG.md","**/dist/**","**/*.d.ts","**/*.d.mts","**/*.d.cts","**/__ddtds__/**"])
      -h, --help                    Show help
          --output <string>         Directory for generated test files (default: "__doctests__")

    "
  `);
});
