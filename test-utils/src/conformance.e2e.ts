/* tests common properties of test frameworks
 * for example, watch mode should rerun when a
 * fence is modified
 */

import { describe, expect, test } from "vitest";
import {
  fence,
  jsdoc,
  jsdocIn,
  markdown,
  spawn,
  type Kind,
  type Outcomes,
  type Runner,
} from "./index.ts";

export type Dialect = {
  /** An assertion that passes when `actual` equals `expected` */
  equal(actual: string, expected: string): string;
};

const PASSED = "passed";
const FAILED = "failed";

type Verdicts = Record<string, typeof PASSED | typeof FAILED>;

const verdicts = (outcomes: Outcomes): Verdicts =>
  Object.fromEntries(
    Object.entries(outcomes)
      .filter(([id]) => /:\d+$/.test(id))
      .map(([id, outcome]) => [id, outcome === PASSED ? PASSED : FAILED]),
  );

type Opened = AsyncDisposable & {
  run(): Promise<Verdicts>;
  watch(): Promise<Verdicts>;
  edit(file: string, content: string): Promise<Verdicts>;
};

const located = (kind: Kind, expected: Verdicts): Verdicts =>
  Object.fromEntries(
    Object.entries(expected).map(([id, verdict]) => {
      const colon = id.lastIndexOf(":");
      return [kind.id(id.slice(0, colon), Number(id.slice(colon + 1))), verdict];
    }),
  );

function open(runner: Runner, kind: Kind, files: Record<string, string>, docs?: string[]): Opened {
  const ddt = spawn(runner, files, { kind, docs });
  return {
    run: async () => verdicts(await ddt.run()),
    watch: async () => verdicts(await ddt.watch()),
    edit: async (file, content) => verdicts(await ddt.edit(file, content)),
    [Symbol.asyncDispose]: () => ddt[Symbol.asyncDispose](),
  };
}

const missingPackage = 'import { x } from "missing-package";\nx;';

export function conformance(name: string, runner: Runner, dialect: Dialect): void {
  const passing = dialect.equal("1", "1");
  const failing = dialect.equal("1", "2");

  const docs: [title: string, doc: string, expected: Verdicts][] = [
    ["a passing fence", fence(passing), { "doc.md:1": PASSED }],
    ["a failing assertion", fence(failing), { "doc.md:1": FAILED }],
    [
      "passing and failing fences under a heading",
      `# Guide\n\n${fence(`const sum: number = 1 + 1;\n${dialect.equal("sum", "2")}`)}${fence(failing)}`,
      { "doc.md:3": PASSED, "doc.md:8": FAILED },
    ],
    ["a syntax error", fence("const = 1;"), { "doc.md:1": FAILED }],
    ["a syntax error at runtime", fence('JSON.parse("{");'), { "doc.md:1": FAILED }],
    ["an undeclared name", fence("missingFn();"), { "doc.md:1": FAILED }],
    ["a missing static import", fence(missingPackage), { "doc.md:1": FAILED }],
    ["a missing dynamic import", fence('await import("missing-package");'), { "doc.md:1": FAILED }],
    [
      "a broken fence next to a passing one",
      fence(missingPackage) + fence(passing),
      { "doc.md:1": FAILED, "doc.md:6": PASSED },
    ],
    ["a fail fence that throws", fence('throw new Error("boom");', "fail"), { "doc.md:1": PASSED }],
    ["a fail fence that passes", fence("1;", "fail"), { "doc.md:1": FAILED }],
    ["a compile_fail fence that compiles", fence("1;", "compile_fail"), { "doc.md:1": FAILED }],
    [
      "a compile_fail fence that throws once compiled",
      fence('throw new Error("boom");', "compile_fail"),
      { "doc.md:1": FAILED },
    ],
    [
      "a compile_fail fence that does not compile",
      fence("const = 1;", "compile_fail"),
      { "doc.md:1": PASSED },
    ],
    [
      "an unclosed fence, which takes the rest of the doc as code",
      `\`\`\`ts run\n${passing}\n\n## Next section\n`,
      { "doc.md:1": FAILED },
    ],
    ["a js fence", fence(passing, "run", "js"), { "doc.md:1": PASSED }],
    ["a javascript fence", fence(passing, "run", "javascript"), { "doc.md:1": PASSED }],
    ["a typescript fence", fence(passing, "run", "typescript"), { "doc.md:1": PASSED }],
    [
      "a type error, which is not checked",
      fence(`const n: number = "a";\n${dialect.equal("n", '"a"')}`),
      { "doc.md:1": PASSED },
    ],
    [
      "a top level await",
      fence(`const one = await Promise.resolve(1);\n${dialect.equal("one", "1")}`),
      { "doc.md:1": PASSED },
    ],
    [
      "fences that do not share variables",
      fence("const shared = 1;") + fence(dialect.equal("shared", "1")),
      { "doc.md:1": PASSED, "doc.md:5": FAILED },
    ],
    ["a fence that is skipped", fence(failing, "skip") + fence(passing), { "doc.md:5": PASSED }],
    [
      "a fence with an unknown annotation",
      fence(failing, "bogus") + fence(passing),
      { "doc.md:5": PASSED },
    ],
    ["a fence without an annotation", fence(failing, "") + fence(passing), { "doc.md:5": PASSED }],
    [
      "a fence in a list",
      `- item\n\n  \`\`\`ts run\n  ${passing}\n  \`\`\`\n`,
      { "doc.md:3": PASSED },
    ],
    ["a fence in a blockquote", `> \`\`\`ts run\n> ${passing}\n> \`\`\`\n`, { "doc.md:1": PASSED }],
    ["a fence in tildes", `~~~ts run\n${passing}\n~~~\n`, { "doc.md:1": PASSED }],
    [
      "a fence after an unclosed html tag",
      `<div\n\n\`\`\`ts run\n${passing}\n\`\`\`\n`,
      { "doc.md:3": PASSED },
    ],
  ];

  const projects: [title: string, files: Record<string, string>, expected: Verdicts][] = [
    [
      "a doc in a nested directory",
      { "docs/api/doc.md": fence(passing) },
      { "docs/api/doc.md:1": PASSED },
    ],
    [
      "several docs",
      { "one.md": fence(passing), "two.md": fence(failing) },
      { "one.md:1": PASSED, "two.md:1": FAILED },
    ],
    [
      "a doc without code next to one with",
      { "empty.md": "# Nothing to run\n", "doc.md": fence(passing) },
      { "doc.md:1": PASSED },
    ],
  ];

  type Version = [doc: string, expected: Verdicts];
  const edits: [title: string, versions: [Version, ...Version[]]][] = [
    [
      "a fence that starts passing, fails, then passes again",
      [
        [fence(passing), { "guide.md:1": PASSED }],
        [fence(failing), { "guide.md:1": FAILED }],
        [fence(passing), { "guide.md:1": PASSED }],
      ],
    ],
    [
      "a syntax error that is introduced and then fixed",
      [
        [fence(passing), { "guide.md:1": PASSED }],
        [fence("const = 1;"), { "guide.md:1": FAILED }],
        [fence(passing), { "guide.md:1": PASSED }],
      ],
    ],
    [
      "an annotation that changes",
      [
        [fence(failing), { "guide.md:1": FAILED }],
        [fence(failing, "fail"), { "guide.md:1": PASSED }],
        [fence(failing, "run"), { "guide.md:1": FAILED }],
      ],
    ],
    [
      "prose around a fence that changes",
      [
        [`# One\n\n${fence(passing)}`, { "guide.md:3": PASSED }],
        [`# Two\n\n${fence(passing)}`, { "guide.md:3": PASSED }],
      ],
    ],
    [
      "a second fence that is added",
      [
        [fence(passing), { "guide.md:1": PASSED }],
        [fence(passing) + fence(failing), { "guide.md:1": PASSED, "guide.md:5": FAILED }],
      ],
    ],
    [
      "one of two fences that is removed",
      [
        [fence(passing) + fence(failing), { "guide.md:1": PASSED, "guide.md:5": FAILED }],
        [fence(failing), { "guide.md:1": FAILED }],
      ],
    ],
    [
      "a fence that moves down the doc",
      [
        [fence(passing), { "guide.md:1": PASSED }],
        [`# Guide\n\n${fence(passing)}`, { "guide.md:3": PASSED }],
      ],
    ],
    [
      "fences that swap places",
      [
        [fence(passing) + fence(failing), { "guide.md:1": PASSED, "guide.md:5": FAILED }],
        [fence(failing) + fence(passing), { "guide.md:1": FAILED, "guide.md:5": PASSED }],
      ],
    ],
    [
      "one of two identical fences that is edited",
      [
        [fence(passing) + fence(passing), { "guide.md:1": PASSED, "guide.md:5": PASSED }],
        [fence(failing) + fence(passing), { "guide.md:1": FAILED, "guide.md:5": PASSED }],
      ],
    ],
  ];

  describe(`${name} conformance`, () => {
    test("runs an mdx doc", async () => {
      await using ddt = open(runner, markdown, {
        "doc.mdx": `# Guide\n\n{/* a comment */}\n\n${fence(passing)}`,
      });
      expect(await ddt.run()).toEqual({ "doc.mdx:5": PASSED });
    });
  });

  describe.each([
    ["markdown", markdown],
    ["JSDoc", jsdoc],
  ])(`${name} %s conformance`, (_, kind) => {
    test.each(docs)("runs %s", async (_title, doc, expected) => {
      await using ddt = open(runner, kind, { "doc.md": doc });
      expect(await ddt.run()).toEqual(located(kind, expected));
    });

    test.each(projects)("runs %s", async (_title, files, expected) => {
      await using ddt = open(runner, kind, files);
      expect(await ddt.run()).toEqual(located(kind, expected));
    });

    test("imports packages from the project", async () => {
      await using ddt = open(runner, kind, {
        "node_modules/calc/package.json":
          '{ "name": "calc", "type": "module", "main": "index.js" }',
        "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
        "README.md": fence(`import { add } from "calc";\n\n${dialect.equal("add(1, 2)", "3")}`),
      });
      expect(await ddt.run()).toEqual(located(kind, { "README.md:1": PASSED }));
    });

    test.each(edits)("reruns %s in watch mode", async (_title, [[doc, expected], ...rest]) => {
      await using ddt = open(runner, kind, { "guide.md": doc });
      expect(await ddt.watch()).toEqual(located(kind, expected));
      for (const [next, outcomes] of rest) {
        // oxlint-disable-next-line no-await-in-loop
        expect(await ddt.edit("guide.md", next)).toEqual(located(kind, outcomes));
      }
    });

    test("runs a doc once it gains its first fence in watch mode", async () => {
      await using ddt = open(runner, kind, {
        "guide.md": "# Guide\n",
        "other.md": fence(passing),
      });
      expect(await ddt.watch()).toEqual(located(kind, { "other.md:1": PASSED }));
      expect(await ddt.edit("guide.md", fence(passing))).toEqual(
        located(kind, { "guide.md:1": PASSED }),
      );
      expect(await ddt.edit("guide.md", fence(failing))).toEqual(
        located(kind, { "guide.md:1": FAILED }),
      );
    });

    test("stops running a doc once it loses its last fence in watch mode", async () => {
      await using ddt = open(runner, kind, {
        "guide.md": fence(passing),
        "other.md": fence(passing),
      });
      expect(await ddt.watch()).toEqual(
        located(kind, { "guide.md:1": PASSED, "other.md:1": PASSED }),
      );
      expect(await ddt.edit("guide.md", "# Guide\n")).toEqual({});
    });
  });

  describe.each([
    ["a .mts file", jsdocIn("mts"), {}],
    ["a .cts file", jsdocIn("cts", "1;"), {}],
    ["a .cjs file", jsdocIn("cjs", "1;"), {}],
    ["a CommonJS package", jsdocIn("ts", "1;"), { "package.json": '{ "type": "commonjs" }' }],
  ])(`${name} JSDoc in %s conformance`, (_, kind, files) => {
    test.each(docs.slice(0, 2))("runs %s", async (_title, doc, expected) => {
      await using ddt = open(runner, kind, { ...files, "doc.md": doc });
      expect(await ddt.run()).toEqual(located(kind, expected));
    });
  });

  describe(`${name} JSDoc entry conformance`, () => {
    const documented = jsdoc.content(fence(passing));

    test("runs no fences of a documented file that the runner only imports", async () => {
      await using ddt = open(
        runner,
        markdown,
        {
          "entry.ts": 'import "./imported.ts";\n',
          "imported.ts": documented,
          "own.ts": documented,
        },
        ["entry.ts", "own.ts"],
      );
      expect(await ddt.run()).toEqual({ "own.ts:2": PASSED });
    });

    test("runs a fence that imports the documented file by its package name", async () => {
      const math = [
        "/**",
        " * ```ts run",
        ' * import { add } from "calc";',
        ` * ${dialect.equal("add(1, 2)", "3")}`,
        " * ```",
        " */",
        "export function add(a: number, b: number): number {",
        "  return a + b;",
        "}",
        "",
      ].join("\n");
      await using ddt = open(
        runner,
        markdown,
        {
          "package.json": '{ "name": "calc", "type": "module", "exports": "./math.ts" }',
          "math.ts": math,
        },
        ["math.ts"],
      );
      expect(await ddt.run()).toEqual({ "math.ts:2": PASSED });
    });
  });
}
