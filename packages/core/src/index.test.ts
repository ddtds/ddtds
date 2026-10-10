import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, test, expect, vi, onTestFinished } from "vitest";
import {
  ANNOTATIONS,
  CodeBlock,
  parseCodeFences,
  defaultDocsExclude,
  defaultDocsInclude,
  findDocs,
  generate,
  resolveDocsOptions,
  type Annotation,
} from "./index";
import { createLogger } from "./logger";

const silent = createLogger("silent");

describe("parseBlocks", () => {
  test.each([
    ["ts", ANNOTATIONS.RUN],
    ["typescript", ANNOTATIONS.RUN],
    ["tsx", ANNOTATIONS.RUN],
    ["jsx", ANNOTATIONS.RUN],
    ["ts", ANNOTATIONS.FAIL],
  ])("collects %s blocks annotated %s", (lang, annotation) => {
    const blocks = parseCodeFences(`\`\`\`${lang} ${annotation}\nconst x = 1\n\`\`\``, silent);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!).toMatchObject({ lang });
  });

  test.each([
    ["ts", ""],
    ["ts", ANNOTATIONS.SKIP],
    ["ts", "unrecognized"],
    ["ts", `${ANNOTATIONS.SKIP} other`],
    ["python", ANNOTATIONS.RUN],
  ])("excludes %s blocks with meta %j", (lang, meta) => {
    const src = meta
      ? `\`\`\`${lang} ${meta}\nconst x = 1\n\`\`\``
      : `\`\`\`${lang}\nconst x = 1\n\`\`\``;
    expect(parseCodeFences(src, silent)).toHaveLength(0);
  });
});

describe("CodeBlock.isSkipped / shouldFail", () => {
  test.each([
    [null, true, false],
    [ANNOTATIONS.SKIP, true, false],
    [ANNOTATIONS.RUN, false, false],
    [ANNOTATIONS.FAIL, false, true],
  ] as const)(
    "annotation=%j → isSkipped=%s shouldFail=%s",
    (annotation, expectedSkipped, expectedFail) => {
      const b = new CodeBlock("x", "ts", annotation, 1);
      expect(b.isSkipped()).toBe(expectedSkipped);
      expect(b.shouldFail()).toBe(expectedFail);
    },
  );
});

describe("CodeBlock.outputExtension / isJsx", () => {
  test.each([
    ["ts", "ts", false],
    ["typescript", "ts", false],
    ["js", "ts", false],
    ["javascript", "ts", false],
    ["tsx", "tsx", true],
    ["jsx", "tsx", true],
  ])("lang=%j → outputExtension=%j isJsx=%s", (lang, ext, jsx) => {
    const b = new CodeBlock("x", lang, ANNOTATIONS.RUN, 1);
    expect(b.outputExtension).toBe(ext);
    expect(b.isJsx()).toBe(jsx);
  });
});

describe("parseBlocks: line numbers", () => {
  test("records correct line for each block in multi-block source", () => {
    const source = [
      "```ts run",
      "const a = 1",
      "```",
      "",
      "prose",
      "",
      "```ts run",
      "const b = 2",
      "```",
    ].join("\n");

    const blocks = parseCodeFences(source, silent);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.line).toBe(1);
    expect(blocks[1]!.line).toBe(7);
  });
});

function block(
  code: string,
  annotation: Annotation | null = null,
  line = 1,
  lang = "ts",
): CodeBlock {
  return new CodeBlock(code, lang, annotation, line);
}

describe("CodeBlock.splitImports", () => {
  test("hoists static imports to file level", () => {
    const b = block("import { foo } from './foo'\nexpect(foo).toBe(1)");
    const { imports, body } = b.splitImports();
    expect(imports).toEqual(["import { foo } from './foo'"]);
    expect(body).not.toContain("import {");
  });

  test("strips export modifiers from runtime declarations", () => {
    const b = block("export const base = 2;\nexport function addOne(x: number) { return x + 1; }");
    const { body } = b.splitImports();
    expect(body).toContain("const base = 2;");
    expect(body).toContain("function addOne");
    expect(body).not.toContain("export");
  });

  test("strips export default from named declarations", () => {
    const b = block("export default class Greeter {}\nconst g = new Greeter();");
    const { body } = b.splitImports();
    expect(body).toContain("class Greeter {}");
    expect(body).toContain("const g = new Greeter();");
    expect(body).not.toContain("export default");
  });

  test("rewrites export default expressions", () => {
    const b = block("export default 1;");
    const { body } = b.splitImports();
    expect(body).toMatchInlineSnapshot(`"const ______default_that_does_not_conflict = 1;"`);
  });

  test("turns parse errors into a thrown SyntaxError", () => {
    const b = block("import { foo } from './foo'\nconst = 1;", null, 10);
    expect(b.splitImports()).toMatchInlineSnapshot(`
      {
        "body": "throw new SyntaxError("Unexpected token (line 12)");",
        "imports": [],
      }
    `);
  });
});

describe("generate", () => {
  test("returns 0 when no docs are found", () => {
    expect(
      generate({ root: "/docs" }, renderBlockFile, { findDocs: () => [], logger: silent }),
    ).toBe(0);
  });

  test("writes one file per runnable block named by line number", () => {
    const writes: Array<{ path: string; content: string }> = [];
    const total = generate({ root: "/repo" }, renderBlockFile, {
      findDocs: () => ["/repo/guide.md", "/repo/prose.md"],
      readFile: (path) =>
        path.endsWith("guide.md") ? "```ts run\nconst x = 1\n```" : "# prose only",
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn<() => void>(),
      logger: silent,
    });

    expect(total).toBe(1);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.path).toBe("/repo/__doctests__/guide_md_1.test.ts");
    expect(writes[0]!.content).toContain("// guide.md:1");
  });

  test("replaces . and path separators with _ in file names", () => {
    const writes: Array<{ path: string; content: string }> = [];
    generate({ root: "/repo/pkg" }, renderBlockFile, {
      findDocs: () => ["/repo/docs/guide.md"],
      readFile: () => "```ts run\nconst x = 1\n```",
      writeFile: (path, content) => writes.push({ path, content }),
      clearDir: vi.fn<() => void>(),
      logger: silent,
    });

    expect(writes[0]!.path).toBe("/repo/pkg/__doctests__/___docs_guide_md_1.test.ts");
    expect(writes[0]!.content).toContain("// ../docs/guide.md:1");
  });
});

describe("findDocs", () => {
  test("skips node_modules and CHANGELOG by default", () => {
    expect(find(fixture())).toEqual(["guide.md", "nested/guide.md"]);
  });

  test("only finds docs matching include", () => {
    expect(find(fixture(), ["nested/*.md"])).toEqual(["nested/guide.md"]);
  });

  test("finds docs outside the root", () => {
    const root = join(fixture(), "nested");
    expect(find(root, ["../*.md"], ["../CHANGELOG.md"])).toEqual(["../guide.md"]);
  });

  test("replaces the default exclude", () => {
    expect(find(fixture(), undefined, ["nested/**"])).toEqual([
      "CHANGELOG.md",
      "guide.md",
      "node_modules/pkg/README.md",
    ]);
  });

  test("keeps the default exclude when spread", () => {
    expect(find(fixture(), undefined, [...defaultDocsExclude, "nested/**"])).toEqual(["guide.md"]);
  });
});

describe("resolveDocsOptions", () => {
  test.each([{}, { include: [], exclude: [] }])("defaults %j", (options) => {
    expect(resolveDocsOptions({ root: "/repo", ...options })).toEqual({
      root: "/repo",
      include: defaultDocsInclude,
      exclude: defaultDocsExclude,
      outputDir: "/repo/__doctests__",
    });
  });

  test("keeps given values", () => {
    const options = { root: "/repo", include: ["a.md"], exclude: ["b.md"], outputDir: "out" };
    expect(resolveDocsOptions(options)).toEqual({ ...options, outputDir: "/repo/out" });
  });
});

function renderBlockFile(mdPath: string, codeBlock: CodeBlock): string {
  return `// ${mdPath}:${codeBlock.line}`;
}

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "ddtds-"));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  for (const doc of ["guide.md", "nested/guide.md", "CHANGELOG.md", "node_modules/pkg/README.md"]) {
    mkdirSync(dirname(join(dir, doc)), { recursive: true });
    writeFileSync(join(dir, doc), "");
  }
  return dir;
}

function find(root: string, include = defaultDocsInclude, exclude = defaultDocsExclude): string[] {
  return findDocs(root, include, exclude)
    .map((doc) => relative(root, doc))
    .toSorted();
}
