import { describe, expect, test } from "vitest";
import { ANNOTATIONS, CodeBlock, type Annotation, type Lang } from "@ddtds/core";
import { generateBlockFile } from "./codegen";

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

describe("generateBlockFile: basic", () => {
  test("emits body directly into the generated test", () => {
    const output = generateBlockFile(
      "example.md",
      block("const hi = '10';\nexpect(hi).toBe('10');"),
    );

    expect(output).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest';
      import { DdtTestError, wrapDdtTest } from '@ddtds/vitest'
      test("example.md:1", async () => {
        await wrapDdtTest(async () => {
          const hi = '10';
          expect(hi).toBe('10');
        });
      });"
    `);
  });
});

describe("generateBlockFile: imports", () => {
  test("hoists multiline imports", () => {
    const code = "import {\n  foo,\n  bar,\n  baz,\n} from './utils'\nfoo()";
    const out = generateBlockFile("t.md", block(code));

    expect(out).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest';
      import { DdtTestError, wrapDdtTest } from '@ddtds/vitest'
      import {
        foo,
        bar,
        baz,
      } from './utils'
      test("t.md:1", async () => {
        await wrapDdtTest(async () => {
          foo()
        });
      });"
    `);
  });
});

describe("generateBlockFile: annotations", () => {
  test("fail annotation wraps in rejects.toThrow", () => {
    const out = generateBlockFile("t.md", block('throw new Error("boom")', ANNOTATIONS.FAIL));
    expect(out).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest';
      import { DdtTestError, wrapDdtTest } from '@ddtds/vitest'
      test("t.md:1", async () => {
        await wrapDdtTest(async () => {
          await expect(async () => {
            throw new Error("boom")
          }).rejects.toThrow();
        });
      });"
    `);
  });

  test("parse errors fail even with the fail annotation", () => {
    const out = generateBlockFile("t.md", block("const = 1;", ANNOTATIONS.FAIL));
    expect(out.replace(/DdtCompileError\(\{.*\}\);/, "DdtCompileError(details);"))
      .toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest';
      import { DdtCompileError, wrapDdtTest } from '@ddtds/vitest'
      test("t.md:1", async () => {
        await wrapDdtTest(async () => {
          throw new DdtCompileError(details);
        });
      });"
    `);
  });

  test("compile_fail passes when the block does not parse", () => {
    const out = generateBlockFile("t.md", block("const = 1;", ANNOTATIONS.COMPILE_FAIL));
    expect(out).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest';
      test("t.md:1", async () => {
      });"
    `);
  });

  test("compile_fail fails when the block parses", () => {
    const out = generateBlockFile("t.md", block("const ok = 1;", ANNOTATIONS.COMPILE_FAIL));
    expect(out).toMatchInlineSnapshot(`
      "import { test, expect } from 'vitest';
      import { DdtTestError, wrapDdtTest } from '@ddtds/vitest'
      test("t.md:1", async () => {
        await wrapDdtTest(async () => {
          throw new Error("expected a compile_fail block to fail to compile");
        });
      });"
    `);
  });
});
