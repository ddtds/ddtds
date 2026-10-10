import { describe, expect, test } from "vitest";
import { ANNOTATIONS, CodeBlock, type Annotation, type Fence, type Lang } from "@ddtds/core";
import { docModule, fenceModule } from "./codegen";

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
    range: { start: { line, column: 1 }, end: { line, column: 1 } },
    indent: 0,
  });
}

function fence(code: string, annotation: Annotation | null = null): Fence {
  return {
    id: "/repo/__doctests__/t_md_1.ts",
    doc: "/repo/docs/t.md",
    block: block(code, annotation),
  };
}

function assertTestRun(x: string) {
  expect(x).toContain("test");
  expect(x).not.toContain("skip");
  expect(x).not.toContain("reject");
}

function assertTestReject(x: string) {
  expect(x).toContain("test");
  expect(x).not.toContain("skip");
  expect(x).toContain("reject");
}

describe("generateBlockFile: basic", () => {
  test("emits body directly into the generated test", () => {
    const output = fenceModule(fence("const hi = '10';\nexpect(hi).toBe('10');"));

    assertTestRun(output);
    expect(output).toContain("expect(hi).toBe('10');");

    expect(output).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      export default async function () {
        const hi = '10';
        expect(hi).toBe('10');
      }"
    `);
  });
});

describe("generateBlockFile: imports", () => {
  test("hoists multiline imports", () => {
    const code = "import {\n  foo,\n  bar,\n  baz,\n} from './utils'\nfoo()";
    const out = fenceModule(fence(code));

    assertTestRun(out);
    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      import {
        foo,
        bar,
        baz,
      } from './utils'
      export default async function () {
        foo()
      }"
    `);
  });
});

describe("generateBlockFile: annotations", () => {
  test("run annotation generates plain test", () => {
    const out = fenceModule(fence("expect(1).toBe(1)", ANNOTATIONS.RUN));
    assertTestRun(out);
    expect(out).not.toContain("rejects");
  });

  test("fail annotation wraps in rejects.toThrow", () => {
    const out = fenceModule(fence('throw new Error("boom")', ANNOTATIONS.FAIL));

    assertTestReject(out);
    expect(out).toContain(".rejects.toThrow();");
    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      export default async function () {
        await expect(async () => {
          throw new Error("boom")
        }).rejects.toThrow();
      }"
    `);
  });

  test("parse errors fail even with the fail annotation", () => {
    const out = fenceModule(fence("const = 1;", ANNOTATIONS.FAIL));
    expect(out.replace(/DdtCompileError\(\{.*\}\);/, "DdtCompileError(details);"))
      .toMatchInlineSnapshot(`
        "import { expect } from 'vitest';
        import { DdtCompileError } from '@ddtds/vitest';
        export default async function () {
          throw new DdtCompileError(details);
        }"
      `);
  });

  test("compile_fail passes when the block does not parse", () => {
    const out = fenceModule(fence("const = 1;", ANNOTATIONS.COMPILE_FAIL));
    expect(out).not.toContain("throw");
    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      export default async function () {}"
    `);
  });

  test("compile_fail fails when the block parses", () => {
    const out = fenceModule(fence("const ok = 1;", ANNOTATIONS.COMPILE_FAIL));
    expect(out).toContain("expected a compile_fail block");
    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      export default async function () {
        throw new Error("expected a compile_fail block to fail to compile");
      }"
    `);
  });
});

describe("in-memory modules", () => {
  test("fence module exports the fence as a function", () => {
    const out = fenceModule(fence("import { foo } from './foo'\nfoo()"));
    expect(out).toContain("export default async function");
    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      import { foo } from './foo'
      export default async function () {
        foo()
      }"
    `);
  });

  test("doc module imports each fence inside its test", () => {
    const fences = [1, 5].map((line) => ({
      block: block("1;", null, line),
      doc: "/root/t.md",
      id: `/root/f${line}.ts`,
    }));
    const out = docModule(fences);
    expect(out).toContain('import("/root/f5.ts")');
    expect(out).toMatchInlineSnapshot(`
      "import { test } from 'vitest';
      import { wrapDdtTest } from '@ddtds/vitest';
      test("t.md:1", () =>
        wrapDdtTest(async () => {
          const { default: run } = await import("/root/f1.ts");
          await run();
        }),
      );
      test("t.md:5", () =>
        wrapDdtTest(async () => {
          const { default: run } = await import("/root/f5.ts");
          await run();
        }),
      );"
    `);
  });
});
