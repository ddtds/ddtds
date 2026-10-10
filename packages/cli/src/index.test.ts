import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { describe, test, expect, vi } from "vitest";
import { generate, type GenerateDeps } from "@ddtds/vitest";

function help(...args: string[]): string {
  const bin = fileURLToPath(new URL("index.ts", import.meta.url));
  const out = execFileSync(process.execPath, [bin, ...args, "--help"], { encoding: "utf8" });
  return stripVTControlCharacters(out);
}

test("ddt --help", () => {
  expect(help()).toMatchInlineSnapshot(`
    "ddt

    Run the code fences in your Markdown docs as tests

    Usage:
      ddt [flags...]
      ddt <command>

    Commands:
      build        Write a test file for each runnable code fence in your docs

    Flags:
      -h, --help        Show help

    "
  `);
});

test("ddt build --help", () => {
  expect(help("build")).toMatchInlineSnapshot(`
    "ddt build

    Write a test file for each runnable code fence in your docs

    Usage:
      ddt build [flags...] [include...]

    Flags:
          --exclude <glob>        Glob of docs to skip (repeatable, replaces default) (default: ["**/node_modules/**","**/CHANGELOG.md"])
      -h, --help                  Show help
          --output <dir>          Directory to write test files to (default: "__doctests__")

    Examples:
      ddt build                                  # docs matching **/*.{md,mdx}
      ddt build "docs/**/*.md" README.md         # only these docs
      ddt build --exclude "**/node_modules/**" --exclude "docs/api/**"

    "
  `);
});

describe("generate", () => {
  test("returns 0 and logs when no docs are found", () => {
    expect(generate({ root: "/docs" }, { findDocs: () => [] })).toBe(0);
  });

  test("generates test files for supported code blocks", () => {
    const writes: Array<{ path: string; content: string }> = [];
    const deps: Partial<GenerateDeps> = {
      findDocs: () => ["/repo/guide.md", "/repo/empty.md"],
      readFile: (path) => {
        if (path.endsWith("guide.md")) return "```ts run\nconst x = 1\n```";
        return "# prose only";
      },
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn<() => void>(),
    };
    const total = generate({ root: "/repo" }, deps);

    expect(total).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.path).toBe("/repo/__doctests__/guide.md_1.test.ts");
    expect(writes[0]!.content).toContain('"guide.md:1"');
  });
});
