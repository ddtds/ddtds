import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { describe, test, expect, onTestFinished } from "vitest";
import {
  CodeBlock,
  DdtCompileError,
  parseCodeFences,
  defaultDocsExclude,
  defaultDocsInclude,
  findDocs,
  resolveDocsOptions,
} from "./index";
import { ANNOTATIONS, isLang, type Annotation, type Lang } from "./constants";

describe("parseBlocks", () => {
  test.each([
    ["ts", ANNOTATIONS.RUN],
    ["typescript", ANNOTATIONS.RUN],
    ["tsx", ANNOTATIONS.RUN],
    ["jsx", ANNOTATIONS.RUN],
    ["ts", ANNOTATIONS.FAIL],
    ["ts", ANNOTATIONS.COMPILE_FAIL],
  ])("collects %s blocks annotated %s", (lang, annotation) => {
    const blocks = parseCodeFences(`\`\`\`${lang} ${annotation}\nconst x = 1\n\`\`\``, "t.md");
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
    expect(parseCodeFences(src, "t.md")).toHaveLength(0);
  });
});

const annotationOf = (meta: string) =>
  parseCodeFences(`\`\`\`ts ${meta}\nconst x = 1\n\`\`\``, "t.md")[0]?.details.annotation ?? null;

describe("fence info strings shared with other tools", () => {
  test.each([
    ["twoslash run", ANNOTATIONS.RUN],
    ['title="astro.config.mjs" run', ANNOTATIONS.RUN],
    ['run title="astro.config.mjs" {2-3}', ANNOTATIONS.RUN],
    ['title="astro.config.mjs" ins={4} del={5} compile_only', ANNOTATIONS.COMPILE_ONLY],
    ['ins="compile_fail" run', ANNOTATIONS.RUN],
    ['title="run me"', null],
    ["twoslash", null],
    ["{1-3}", null],
    ["run fail", null],
    ["skip twoslash", null],
  ])("%s gives annotation %s", (meta, annotation) => {
    expect(annotationOf(meta)).toBe(annotation);
  });
});

describe("CodeBlock.shouldFail / shouldFailToCompile", () => {
  test.each([
    [ANNOTATIONS.RUN, false, false],
    [ANNOTATIONS.FAIL, true, false],
    [ANNOTATIONS.COMPILE_FAIL, false, true],
  ] as const)(
    "annotation=%j → shouldFail=%s shouldFailToCompile=%s",
    (annotation, expectedFail, expectedCompileFail) => {
      const b = block("x", annotation);
      expect(b.shouldFail()).toBe(expectedFail);
      expect(b.shouldFailToCompile()).toBe(expectedCompileFail);
    },
  );
});

describe("CodeBlock.outputExtension", () => {
  test.each([
    ["ts", "ts"],
    ["typescript", "ts"],
    ["js", "ts"],
    ["javascript", "ts"],
    ["tsx", "tsx"],
    ["jsx", "tsx"],
    ["tsrx", "tsrx"],
  ] as const)("lang=%j → outputExtension=%j", (lang, ext) => {
    expect(block("x", ANNOTATIONS.RUN, 1, lang).outputExtension).toBe(ext);
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

    const blocks = parseCodeFences(source, "t.md");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.line).toBe(1);
    expect(blocks[1]!.line).toBe(7);
  });
});

function block(
  code: string,
  annotation: Annotation | null = null,
  line = 1,
  lang: Lang = "ts",
): CodeBlock {
  return new CodeBlock({
    code,
    lang,
    annotation,
    path: "t.md",
    rangeInText: { start: { line, column: 1 }, end: { line, column: 1 } },
  });
}

function compileError(b: CodeBlock): DdtCompileError {
  try {
    b.splitImports();
  } catch (error) {
    if (error instanceof DdtCompileError) return error;
    throw error;
  }
  throw new Error("expected a DdtCompileError");
}

function split(b: CodeBlock): { imports: string[]; body: string } {
  const { imports, body } = b.splitImports();
  return { imports: imports.map(String), body: body.join("\n") };
}

describe("CodeBlock.splitImports", () => {
  test("hoists static imports to file level", () => {
    const b = block("import { foo } from './foo'\nexpect(foo).toBe(1)");
    const { imports, body } = split(b);
    expect(imports).toEqual(["import { foo } from './foo'"]);
    expect(body).not.toContain("import {");
  });

  test("strips export modifiers from runtime declarations", () => {
    const b = block("export const base = 2;\nexport function addOne(x: number) { return x + 1; }");
    const { body } = split(b);
    expect(body).toContain("const base = 2;");
    expect(body).toContain("function addOne");
    expect(body).not.toContain("export");
  });

  test("strips export default from named declarations", () => {
    const b = block("export default class Greeter {}\nconst g = new Greeter();");
    const { body } = split(b);
    expect(body).toContain("class Greeter {}");
    expect(body).toContain("const g = new Greeter();");
    expect(body).not.toContain("export default");
  });

  test("rewrites export default expressions", () => {
    const b = block("export default 1;");
    const { body } = split(b);
    expect(body).toMatchInlineSnapshot(`"const ______default_that_does_not_conflict = 1;"`);
  });

  test("rewrites anonymous default declarations as expressions", () => {
    const fn = block("export default function () { return 1; }");
    expect(split(fn).body).toMatchInlineSnapshot(
      `"const ______default_that_does_not_conflict = function () { return 1; };"`,
    );
    const cls = block("export default class {}");
    expect(split(cls).body).toMatchInlineSnapshot(
      `"const ______default_that_does_not_conflict = class {};"`,
    );
  });

  test("parses tsrx with @tsrx/oxc", () => {
    const b = block("import { x } from './x'\nfunction A() @{\n  <p>{x}</p>\n}", null, 1, "tsrx");
    expect(split(b)).toEqual({
      imports: ["import { x } from './x'"],
      body: "function A() @{\n  <p>{x}</p>\n}",
    });
  });

  test("renders a compile error for every language", () => {
    const broken: Record<Lang, string> = {
      ts: "const x: = 1;",
      typescript: "const x: = 1;",
      js: "const = 1;",
      javascript: "const = 1;",
      tsx: "const a = <div>;",
      jsx: "const a = <div>;",
      tsrx: "function Greeting() @{\n  <p>\n}",
      mjs: "const = 1;",
      mts: "const x: = 1;",
      cjs: "const = 1;",
      cts: "const x: = 1;",
    };
    const messages: Record<string, string> = {};
    for (const [lang, code] of Object.entries(broken)) {
      if (isLang(lang)) messages[lang] = compileError(block(code, null, 10, lang)).message;
    }
    expect(messages).toMatchInlineSnapshot(`
      {
        "cjs": "t.md:11:7 Unexpected token (cjs block at line 10)",
        "cts": "t.md:11:10 Unexpected token (cts block at line 10)",
        "javascript": "t.md:11:7 Unexpected token (javascript block at line 10)",
        "js": "t.md:11:7 Unexpected token (js block at line 10)",
        "jsx": "t.md:11:16 Unexpected token (jsx block at line 10)",
        "mjs": "t.md:11:7 Unexpected token (mjs block at line 10)",
        "mts": "t.md:11:10 Unexpected token (mts block at line 10)",
        "ts": "t.md:11:10 Unexpected token (ts block at line 10)",
        "tsrx": "t.md:12:3 unterminated JSX element starting at byte 25 (tsrx block at line 10)",
        "tsx": "t.md:11:16 Unexpected token (tsx block at line 10)",
        "typescript": "t.md:11:10 Unexpected token (typescript block at line 10)",
      }
    `);
  });

  test("adds the fence indent to columns", () => {
    const source = "- step one:\n\n  ```ts run\n  const = 1;\n  ```\n";
    const [b] = parseCodeFences(source, "t.md");
    expect(b && compileError(b).message).toMatchInlineSnapshot(
      `"t.md:4:9 Unexpected token (ts block at line 3)"`,
    );
  });

  test("keeps every label and the raw parser error", () => {
    const source = "# Guide\n\n```ts run\nlet x = 1;\nlet x = 2;\n```\n";
    const [b] = parseCodeFences(source, "t.md");
    const error = b && compileError(b);
    expect(error?.message).toMatchInlineSnapshot(
      `"t.md:4:5 Identifier \`x\` has already been declared (ts block at line 3)"`,
    );
    expect(error?.details).toMatchInlineSnapshot(
      {
        parser: { version: expect.any(String) },
        diagnostics: [{ source: expect.any(Object) }],
      },
      `
      {
        "block": {
          "annotation": "run",
          "contents": "let x = 1;
      let x = 2;",
          "file": "t.md",
          "lang": "ts",
          "range": {
            "end": {
              "column": 4,
              "line": 6,
            },
            "start": {
              "column": 1,
              "line": 3,
            },
          },
        },
        "diagnostics": [
          {
            "labels": [
              {
                "end": {
                  "column": 6,
                  "line": 4,
                },
                "message": "\`x\` has already been declared here",
                "start": {
                  "column": 5,
                  "line": 4,
                },
              },
              {
                "end": {
                  "column": 6,
                  "line": 5,
                },
                "message": "It can not be redeclared here",
                "start": {
                  "column": 5,
                  "line": 5,
                },
              },
            ],
            "message": "Identifier \`x\` has already been declared",
            "source": Any<Object>,
          },
        ],
        "parser": {
          "name": "ts",
          "package": "oxc-parser",
          "version": Any<String>,
        },
        "phase": "parse",
      }
    `,
    );
  });

  test.each([
    ["<p>", "parse"],
    ["function A() @{", "parser-crash"],
  ])("reports broken tsrx %j as %s", (code, phase) => {
    expect(compileError(block(code, null, 1, "tsrx")).details.phase).toBe(phase);
  });
});

describe("findDocs", () => {
  test("skips node_modules and CHANGELOG by default", () => {
    expect(find(fixture())).toEqual(["guide.md", "nested/guide.md"]);
  });

  test("skips declaration files by default", () => {
    const root = fixture();
    for (const doc of ["types.d.ts", "types.d.mts", "types.d.cts"]) {
      writeFileSync(join(root, doc), "");
    }
    expect(find(root)).toEqual(["guide.md", "nested/guide.md"]);
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
    });
  });

  test("keeps given values", () => {
    const options = { root: "/repo", include: ["a.md"], exclude: ["b.md"] };
    expect(resolveDocsOptions(options)).toEqual(options);
  });
});

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
