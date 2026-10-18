import { describe, expect, test } from "vitest";
import { parseCodeFences } from "../fences/blocks.ts";
import { resolveModule } from "./resolve-module.ts";

function resolve(lang: string, code: string, file = "doc.md", fallback: "esm" | "cjs" = "esm") {
  const [block] = parseCodeFences(`\`\`\`${lang} run\n${code}\n\`\`\`\n`, file);
  if (!block) throw new Error("no block");
  const { esmSyntax } = block.splitImports();
  return resolveModule(block, { esmSyntax, fallback });
}

describe("resolveModule", () => {
  test.each([
    ["cjs", "esm"],
    ["cts", "esm"],
    ["mjs", "cjs"],
    ["mts", "cjs"],
  ] as const)("a %s fence names its own system over the fallback %s", (lang, fallback) => {
    expect(resolve(lang, "1;", "doc.md", fallback)).toBe(lang.startsWith("c") ? "cjs" : "esm");
  });

  test("a language beats ESM syntax", () => {
    expect(resolve("cjs", "import 'x';")).toBe("cjs");
  });

  test("a source file extension names the system for plain languages", () => {
    expect(resolve("ts", "1;", "a.cts")).toBe("cjs");
    expect(resolve("js", "1;", "a.mjs", "cjs")).toBe("esm");
  });

  test.each([
    "import x from 'x';",
    "import 'x';",
    "export const a = 1;",
    "const u = import.meta.url;",
  ])("ESM syntax makes %s ESM over a CommonJS fallback", (code) => {
    expect(resolve("js", code, "doc.md", "cjs")).toBe("esm");
  });

  test.each([
    "import type { A } from 'x';",
    "import { type A } from 'x';",
    "export type A = 1;",
    "export interface B {}",
    "const x = import('x');",
    "// import x from 'x'\nconst s = \"export const a = 1\";",
    "const x = require('x');",
  ])("%s does not count as ESM syntax", (code) => {
    expect(resolve("ts", code, "doc.md", "cjs")).toBe("cjs");
  });

  test("nothing named falls back to the default", () => {
    expect(resolve("ts", "1;", "doc.md", "esm")).toBe("esm");
    expect(resolve("ts", "1;", "doc.md", "cjs")).toBe("cjs");
  });
});
