import { describe, expect, test } from "vitest";
import {
  ANNOTATIONS,
  CodeBlock,
  docModule as generateDocModule,
  fenceModule as generateFenceModule,
  type Annotation,
  type Fence,
  type Lang,
} from "@ddtds/core";
import { vitestRunner } from "./runner.ts";

const fenceModule = (fence: Fence): string => generateFenceModule(vitestRunner, fence).code;
const docModule = (fences: readonly Fence[]): string =>
  generateDocModule(vitestRunner, "/root/t.md", fences).code;

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

describe("generateBlockFile: basic", () => {
  test("emits body directly into the generated test", () => {
    const output = fenceModule(fence("const hi = '10';\nexpect(hi).toBe('10');"));

    expect(output).toContain("expect(hi).toBe('10');");

    expect(output).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      export default async () => {
        const hi = '10';
        expect(hi).toBe('10');
      };"
    `);
  });
});

describe("generateBlockFile: imports", () => {
  test("hoists multiline imports", () => {
    const code = "import {\n  foo,\n  bar,\n  baz,\n} from './utils'\nfoo()";
    const out = fenceModule(fence(code));

    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      import {
        foo,
        bar,
        baz,
      } from './utils'
      export default async () => {
        foo()
      };"
    `);
  });
});

describe("generateBlockFile: annotations", () => {
  test("run annotation generates plain test", () => {
    const out = fenceModule(fence("expect(1).toBe(1)", ANNOTATIONS.RUN));
    expect(out).not.toContain("expectFailure");
  });

  test("fail annotation wraps in expectFailure", () => {
    const out = fenceModule(fence('throw new Error("boom")', ANNOTATIONS.FAIL));

    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      import { expectFailure } from '@ddtds/vitest/runtime';
      export default expectFailure(async () => {
        throw new Error("boom")
      });"
    `);
  });

  test("parse errors fail even with the fail annotation", () => {
    const out = fenceModule(fence("const = 1;", ANNOTATIONS.FAIL));
    expect(out.replace(/, \{.*\}\);/, ", details);")).toMatchInlineSnapshot(`
      "import { compileError } from '@ddtds/vitest/runtime';
      export default compileError("/repo/docs/t.md", details);"
    `);
  });

  test("compile_fail passes when the block does not parse", () => {
    const out = fenceModule(fence("const = 1;", ANNOTATIONS.COMPILE_FAIL));
    expect(out).not.toContain("throw");
    expect(out).toMatchInlineSnapshot(`"export default async () => {};"`);
  });

  test("compile_fail fails when the block parses", () => {
    const out = fenceModule(fence("const ok = 1;", ANNOTATIONS.COMPILE_FAIL));
    expect(out).toContain("missingCompileError(");
    expect(out).toMatchInlineSnapshot(`
      "import { missingCompileError } from '@ddtds/vitest/runtime';
      export default missingCompileError("/repo/docs/t.md", {"line":1,"column":1});"
    `);
  });
});

describe("in-memory modules", () => {
  test("fence module exports the fence as a function", () => {
    const out = fenceModule(fence("import { foo } from './foo'\nfoo()"));
    expect(out).toContain("export default async () =>");
    expect(out).toMatchInlineSnapshot(`
      "import { expect } from 'vitest';
      import { foo } from './foo'
      export default async () => {
        foo()
      };"
    `);
  });

  test("doc module loads every fence before its tests run", () => {
    const fences = [1, 5].map((line) => ({
      block: block("1;", null, line),
      doc: "/root/t.md",
      id: `/root/f${line}.ts`,
    }));
    const out = docModule(fences);
    expect(out).toContain('import("/root/f5.ts")');
    expect(out).toMatchInlineSnapshot(`
      "import { test } from 'vitest';
      import { loadFences } from '@ddtds/vitest/runtime';
      const fences = await loadFences([
        () => import("/root/f1.ts"),
        () => import("/root/f5.ts"),
      ]);
      test("t.md:1", fences[0]);
      test("t.md:5", fences[1]);"
    `);
  });
});
