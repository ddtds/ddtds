/* tests common properties of test frameworks
 * for example, watch mode should rerun when a
 * fence is modified
 */

import { describe, expect, test } from "vitest";
import { ANNOTATIONS, type Lang } from "@ddtds/core/fences";
import { typedImports, type StaticImport } from "@ddtds/core/config";
import {
  fence,
  jsdoc,
  jsdocIn,
  markdown,
  spawn,
  type Failures,
  type Kind,
  type Outcomes,
  type Runner,
} from "./index.ts";

/** Tests are named by line, or by title, which has no file extension or directory */
const TEST_ID = /:\d+$|^[^./]+$/;

/** Imports a runner injects into fences: the defaults, or only `extra` without them */
export type Globals = {
  defaults: boolean;
  extra: readonly StaticImport[];
};

export type Dialect = {
  /** An assertion that passes when `actual` equals `expected` */
  equal(actual: string, expected: string): string;
  /** Module system of the project and its fences. Defaults to `"esm"` */
  module?: "esm" | "cjs";
  nativeModules?: boolean;
  /** A runner with typecheck on, in a project that has TypeScript installed */
  typecheck?: { runner: () => Runner };
  globals?: {
    /** Names the runner injects into every fence by default */
    names: readonly string[];
    runner: (globals: Globals) => Runner;
  };
};

const PASSED = "passed";
const FAILED = "failed";
const TYPECHECK_TIMEOUT = 30_000;

type Verdicts = Record<string, typeof PASSED | typeof FAILED>;

const verdicts = (outcomes: Outcomes): Verdicts =>
  Object.fromEntries(
    Object.entries(outcomes)
      .filter(([id]) => TEST_ID.test(id))
      .map(([id, outcome]) => [id, outcome === PASSED ? PASSED : FAILED]),
  );

type Opened = AsyncDisposable & {
  readonly failures: Failures;
  run(): Promise<Verdicts>;
  watch(): Promise<Verdicts>;
  edit(file: string, content: string): Promise<Verdicts>;
};

const splitId = (id: string): [name: string, line: number] => {
  const colon = id.lastIndexOf(":");
  return [id.slice(0, colon), Number(id.slice(colon + 1))];
};

const endsWithLine = /:\d+$/;

/** Ids without a line are test titles, which name tests as written */
const located = (kind: Kind, expected: Verdicts): Verdicts =>
  Object.fromEntries(
    Object.entries(expected).map(([id, verdict]) => [
      endsWithLine.test(id) ? kind.id(...splitId(id)) : id,
      verdict,
    ]),
  );

type Where = readonly [line: number, column: number];
type Wheres = Record<string, Where[]>;

const placed = (kind: Kind, expected: Wheres): Failures =>
  Object.fromEntries(
    Object.entries(expected).map(([id, wheres]) => {
      const [name, line] = splitId(id);
      return [kind.id(name, line), wheres.map(([at, column]) => kind.frame(name, at, column))];
    }),
  );

function open(runner: Runner, kind: Kind, files: Record<string, string>, docs?: string[]): Opened {
  const ddt = spawn(runner, files, { kind, docs });
  return {
    get failures() {
      return ddt.failures;
    },
    run: async () => verdicts(await ddt.run()),
    watch: async () => verdicts(await ddt.watch()),
    edit: async (file, content) => verdicts(await ddt.edit(file, content)),
    [Symbol.asyncDispose]: () => ddt[Symbol.asyncDispose](),
  };
}

const lines = (...statements: string[]): string => statements.join("\n");
const injected = (global: string): string =>
  `if (typeof ${global} === "undefined") throw new Error("${global} missing");`;
const notInjected = (global: string): string =>
  `if (typeof ${global} !== "undefined") throw new Error("${global} injected");`;

export function conformance(name: string, runner: Runner, dialect: Dialect): void {
  const commonjs = dialect.module === "cjs";
  const importNames = (names: string, from: string): string =>
    commonjs ? `const { ${names} } = require("${from}");` : `import { ${names} } from "${from}";`;
  const importOnly = (from: string): string =>
    commonjs ? `require("${from}");` : `import "${from}";`;
  const project: Record<string, string> = commonjs
    ? { "package.json": '{ "type": "commonjs" }' }
    : {};
  const calc: Record<string, string> = commonjs
    ? {
        "node_modules/calc/package.json": '{ "name": "calc", "main": "index.js" }',
        "node_modules/calc/index.js": "exports.add = (a, b) => a + b;",
      }
    : {
        "node_modules/calc/package.json":
          '{ "name": "calc", "type": "module", "main": "index.js" }',
        "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
      };
  // a CommonJS entry cannot hold `export`, which `jsdoc` appends
  const jsdocKind = commonjs ? jsdocIn("ts", "1;") : jsdoc;
  const indentedKind = jsdocIn("ts", commonjs ? "1;" : undefined, "    ");
  const openProject = (
    kind: Kind,
    files: Record<string, string>,
    docs?: string[],
    using: Runner = runner,
  ): Opened => open(using, kind, { ...project, ...files }, docs);
  const missingPackage = `${importNames("x", "missing-package")}\nx;`;
  const passing = dialect.equal("1", "1");
  const failing = dialect.equal("1", "2");
  const throwingBody = 'throw new Error("boom");';
  const isRequireDefined = (expected: "function" | "undefined"): string =>
    dialect.equal("typeof require", JSON.stringify(expected));

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
    [
      "a fail fence that throws",
      fence('throw new Error("boom");', ANNOTATIONS.FAIL),
      { "doc.md:1": PASSED },
    ],
    ["a fail fence that passes", fence("1;", ANNOTATIONS.FAIL), { "doc.md:1": FAILED }],
    [
      "a compile_fail fence that compiles",
      fence("1;", ANNOTATIONS.COMPILE_FAIL),
      { "doc.md:1": FAILED },
    ],
    [
      "a compile_fail fence that throws once compiled",
      fence('throw new Error("boom");', ANNOTATIONS.COMPILE_FAIL),
      { "doc.md:1": FAILED },
    ],
    [
      "a compile_fail fence that does not compile",
      fence("const = 1;", ANNOTATIONS.COMPILE_FAIL),
      { "doc.md:1": PASSED },
    ],
    [
      "a compile_only fence that throws",
      fence(throwingBody, ANNOTATIONS.COMPILE_ONLY),
      { "doc.md:1": PASSED },
    ],
    [
      "a compile_only fence that never ends",
      fence("while (true) {}", ANNOTATIONS.COMPILE_ONLY),
      { "doc.md:1": PASSED },
    ],
    [
      "a compile_only fence with a failing assertion",
      fence(failing, ANNOTATIONS.COMPILE_ONLY),
      { "doc.md:1": PASSED },
    ],
    [
      "a compile_only fence with a syntax error",
      fence("const = 1;", ANNOTATIONS.COMPILE_ONLY),
      { "doc.md:1": FAILED },
    ],
    // a CommonJS fence requires its imports from inside its body
    ...(commonjs
      ? []
      : [
          [
            "a compile_only fence with a missing import",
            fence(missingPackage, ANNOTATIONS.COMPILE_ONLY),
            { "doc.md:1": FAILED },
          ] satisfies [string, string, Verdicts],
        ]),
    [
      "a compile_only fence that does not run its code",
      fence(`globalThis.__ddtdsCompileOnly = true;`, ANNOTATIONS.COMPILE_ONLY) +
        fence(dialect.equal("typeof globalThis.__ddtdsCompileOnly", '"undefined"')),
      { "doc.md:1": PASSED, "doc.md:5": PASSED },
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
    [
      "a fence in a list",
      `- item\n\n  \`\`\`ts run\n  ${passing}\n  \`\`\`\n`,
      { "doc.md:3": PASSED },
    ],
    [
      "a fence after a setup comment",
      `<!-- ddt-setup const one = 1; -->\n\n${fence(dialect.equal("one", "1"))}`,
      { "doc.md:3": PASSED },
    ],
    [
      "a fence after a multi line setup comment with an import",
      `<!-- ddt-setup\n${importNames("sep", "node:path")}\nconst one = 1;\n-->\n\n${fence(dialect.equal("typeof sep", '"string"') + "\n" + dialect.equal("one", "1"))}`,
      { "doc.md:6": PASSED },
    ],
    [
      "setup comments with other comments and blank lines between",
      `<!-- ddt-setup const a = 1; -->\n\n<!-- note -->\n<!-- ddt-setup const b = a + 1; -->\n\n${fence(dialect.equal("b", "2"))}`,
      { "doc.md:6": PASSED },
    ],
    [
      "a setup comment that reaches only the next fence",
      `<!-- ddt-setup const one = 1; -->\n\n${fence(dialect.equal("one", "1"))}${fence(dialect.equal("typeof one", '"undefined"'))}`,
      { "doc.md:3": PASSED, "doc.md:7": PASSED },
    ],
    [
      "a setup comment separated from the fence by text",
      `<!-- ddt-setup const one = 1; -->\n\nText.\n\n${fence(dialect.equal("typeof one", '"undefined"'))}`,
      { "doc.md:5": PASSED },
    ],
    [
      "a comment without the setup marker",
      `<!-- const one = 1; -->\n\n${fence(dialect.equal("typeof one", '"undefined"'))}`,
      { "doc.md:3": PASSED },
    ],
    [
      "a setup marker inside a fence",
      fence(
        `const text = "<!-- ddt-setup const one = 1; -->";\n${dialect.equal("typeof one", '"undefined"')}`,
      ),
      { "doc.md:1": PASSED },
    ],
    [
      "a setup comment that throws",
      `<!-- ddt-setup throw new Error("boom"); -->\n\n${fence(passing)}`,
      { "doc.md:3": FAILED },
    ],
    [
      "a setup comment above a fail fence",
      `<!-- ddt-setup const boom = () => { throw new Error("boom"); }; -->\n\n${fence("boom();", ANNOTATIONS.FAIL)}`,
      { "doc.md:3": PASSED },
    ],
    [
      "a setup comment above a skipped fence",
      `<!-- ddt-setup throw new Error("boom"); -->\n\n${fence(failing, ANNOTATIONS.SKIP)}${fence(passing)}`,
      { "doc.md:7": PASSED },
    ],
    [
      "a setup comment above a compile_fail fence that does not compile",
      `<!-- ddt-setup const one = 1; -->\n\n${fence("const = 1;", ANNOTATIONS.COMPILE_FAIL)}`,
      { "doc.md:3": PASSED },
    ],
    [
      "a setup comment with CRLF line endings",
      `<!-- ddt-setup\nconst one = 1;\n-->\n\n${fence(dialect.equal("one", "1"))}`.replaceAll(
        "\n",
        "\r\n",
      ),
      { "doc.md:5": PASSED },
    ],
    [
      "a setup comment in a blockquote",
      `> <!-- ddt-setup const one = 1; -->\n>\n> \`\`\`ts run\n> ${dialect.equal("one", "1")}\n> \`\`\`\n`,
      { "doc.md:3": PASSED },
    ],
    [
      "a setup comment above a fence in a list",
      `<!-- ddt-setup const one = 1; -->\n\n- item\n\n  <!-- ddt-setup const two = 2; -->\n\n  \`\`\`ts run\n  ${dialect.equal("two", "2")}\n  \`\`\`\n`,
      { "doc.md:7": PASSED },
    ],
  ];

  /** Parser-only cases, the same for every doc kind */
  const throwing = 'throw new TypeError("boom");';
  const locations: [title: string, doc: string, expected: Wheres][] = [
    ["a passing fence", fence(passing), {}],
    ["a throw", fence(`const a = 1;\n${throwing}`), { "doc.md:1": [[3, 7]] }],
    ["a syntax error", fence("const ok = 1;\nconst = 1;"), { "doc.md:1": [[3, 7]] }],
    [
      "a throw after an await",
      fence(`await Promise.resolve();\n${throwing}`),
      { "doc.md:1": [[3, 7]] },
    ],
    [
      "a throw in a called function",
      fence(`function boom() {\n  ${throwing}\n}\nboom();`),
      {
        "doc.md:1": [
          [3, 9],
          [5, 1],
        ],
      },
    ],
    [
      "a throw in the second fence",
      `${fence(passing)}${fence(throwing)}`,
      { "doc.md:5": [[6, 7]] },
    ],
    [
      "a throw in a setup comment",
      `<!-- ddt-setup ${throwing} -->\n\n${fence(passing)}`,
      { "doc.md:3": [[1, 22]] },
    ],
    [
      "a throw on the second line of a setup comment",
      `<!-- ddt-setup\nconst a = 1;\n${throwing}\n-->\n\n${fence(passing)}`,
      { "doc.md:6": [[3, 7]] },
    ],
    [
      "a throw in a setup comment in a list",
      `- item\n\n  <!-- ddt-setup ${throwing} -->\n\n  \`\`\`ts run\n  ${passing}\n  \`\`\`\n`,
      { "doc.md:5": [[3, 24]] },
    ],
    [
      "a throw on the second line of a setup comment in a list",
      `- item\n\n  <!-- ddt-setup\n  const a = 1;\n  ${throwing}\n  -->\n\n  \`\`\`ts run\n  ${passing}\n  \`\`\`\n`,
      { "doc.md:8": [[5, 9]] },
    ],
    [
      "a throw in a setup comment in a blockquote",
      `> <!-- ddt-setup ${throwing} -->\n>\n> \`\`\`ts run\n> ${passing}\n> \`\`\`\n`,
      { "doc.md:3": [[1, 24]] },
    ],
    [
      "a throw in a setup comment with CRLF line endings",
      `<!-- ddt-setup\nconst a = 1;\n${throwing}\n-->\n\n${fence(passing)}`.replaceAll(
        "\n",
        "\r\n",
      ),
      { "doc.md:6": [[3, 7]] },
    ],
    [
      "a throw in the fence after a setup comment",
      `<!-- ddt-setup const a = 1; -->\n\n${fence(`const b = 1;\n${throwing}`)}`,
      { "doc.md:3": [[5, 7]] },
    ],
  ];

  const relocations: [
    title: string,
    versions: [[doc: string, expected: Wheres], ...[doc: string, expected: Wheres][]],
  ][] = [
    [
      "a failing fence moves down",
      [
        [fence(throwing), { "guide.md:1": [[2, 7]] }],
        [fence(`const a = 1;\n${throwing}`), { "guide.md:1": [[3, 7]] }],
      ],
    ],
    [
      "a failing fence is fixed",
      [
        [fence(throwing), { "guide.md:1": [[2, 7]] }],
        [fence(passing), {}],
      ],
    ],
  ];

  const parsing: [title: string, doc: string, expected: Verdicts][] = [
    [
      "an unclosed fence, which takes the rest of the doc as code",
      `\`\`\`ts run\n${passing}\n\n## Next section\n`,
      { "doc.md:1": FAILED },
    ],
    ["a js fence", fence(passing, ANNOTATIONS.RUN, "js"), { "doc.md:1": PASSED }],
    ["a javascript fence", fence(passing, ANNOTATIONS.RUN, "javascript"), { "doc.md:1": PASSED }],
    ["a typescript fence", fence(passing, ANNOTATIONS.RUN, "typescript"), { "doc.md:1": PASSED }],
    [
      "a type error, which is not checked",
      fence(`const n: number = "a";\n${dialect.equal("n", '"a"')}`),
      { "doc.md:1": PASSED },
    ],
    [
      "a fence that is skipped",
      fence(failing, ANNOTATIONS.SKIP) + fence(passing),
      { "doc.md:5": PASSED },
    ],
    [
      "a fence with an unknown annotation",
      fence(failing, "bogus") + fence(passing),
      { "doc.md:5": PASSED },
    ],
    [
      "a fence with other tools' words",
      fence(passing, 'twoslash title="a run" {1} run'),
      { "a run": PASSED },
    ],
    [
      "a fence with only other tools' words",
      fence(failing, "title=hi") + fence(passing),
      { "doc.md:5": PASSED },
    ],
    [
      "a failing fence with other tools' words",
      fence(failing, "title=hi {1} fail"),
      { hi: PASSED },
    ],
    [
      "a compile_only fence with other tools' words",
      fence(failing, "title=hi compile_only"),
      { hi: PASSED },
    ],
    [
      "a fence titled as its test",
      fence(passing, 'title="adds numbers" run') + fence(passing, "title=two run"),
      { "adds numbers": PASSED, two: PASSED },
    ],
    [
      "a failing fence titled as its test",
      fence(failing, "title='does not work' run"),
      { "does not work": FAILED },
    ],
    [
      "a fence with two annotations",
      fence(failing, "run fail") + fence(passing),
      { "doc.md:5": PASSED },
    ],
    ["a fence without an annotation", fence(failing, "") + fence(passing), { "doc.md:5": PASSED }],
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
        [fence(failing, ANNOTATIONS.FAIL), { "guide.md:1": PASSED }],
        [fence(failing, ANNOTATIONS.RUN), { "guide.md:1": FAILED }],
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
      "a setup comment that is edited",
      [
        [
          `<!-- ddt-setup const n = 1; -->\n\n${fence(dialect.equal("n", "1"))}`,
          { "guide.md:3": PASSED },
        ],
        [
          `<!-- ddt-setup const n = 2; -->\n\n${fence(dialect.equal("n", "1"))}`,
          { "guide.md:3": FAILED },
        ],
        [
          `<!-- ddt-setup const n = 1; -->\n\n${fence(dialect.equal("n", "1"))}`,
          { "guide.md:3": PASSED },
        ],
      ],
    ],
    [
      "a setup comment that is added and removed",
      [
        [fence(dialect.equal("typeof n", '"undefined"')), { "guide.md:1": PASSED }],
        [
          `<!-- ddt-setup const n = 1; -->\n\n${fence(dialect.equal("typeof n", '"undefined"'))}`,
          { "guide.md:3": FAILED },
        ],
        [fence(dialect.equal("typeof n", '"undefined"')), { "guide.md:1": PASSED }],
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

  describe.concurrent(`${name} conformance`, () => {
    test("runs an mdx doc", async () => {
      await using ddt = openProject(markdown, {
        "doc.mdx": `# Guide\n\n{/* a comment */}\n\n${fence(passing)}`,
      });
      expect(await ddt.run()).toEqual({ "doc.mdx:5": PASSED });
    });

    test("runs a fence after an mdx setup comment", async () => {
      await using ddt = openProject(markdown, {
        "doc.mdx": `{/* ddt-setup const one = 1; */}\n\n${fence(dialect.equal("one", "1"))}`,
      });
      expect(await ddt.run()).toEqual({ "doc.mdx:3": PASSED });
    });

    test("runs a fence after mdx setup comments with other comments between", async () => {
      await using ddt = openProject(markdown, {
        "doc.mdx": `{/* ddt-setup const a = 1; */}\n\n{/* note */}\n{/* ddt-setup\nconst b = a + 1;\n*/}\n\n${fence(dialect.equal("b", "2"))}`,
      });
      expect(await ddt.run()).toEqual({ "doc.mdx:8": PASSED });
    });

    test("limits an mdx setup comment to the next fence", async () => {
      await using ddt = openProject(markdown, {
        "doc.mdx": `{/* ddt-setup const one = 1; */}\n\n${fence(dialect.equal("one", "1"))}${fence(dialect.equal("typeof one", '"undefined"'))}`,
      });
      expect(await ddt.run()).toEqual({ "doc.mdx:3": PASSED, "doc.mdx:7": PASSED });
    });

    test("ignores an mdx comment without the setup marker", async () => {
      await using ddt = openProject(markdown, {
        "doc.mdx": `{/* const one = 1; */}\n\n${fence(dialect.equal("typeof one", '"undefined"'))}`,
      });
      expect(await ddt.run()).toEqual({ "doc.mdx:3": PASSED });
    });

    test("fails a fence whose mdx setup comment throws, at the comment", async () => {
      await using ddt = openProject(markdown, {
        "doc.mdx": `{/* ddt-setup throw new TypeError("boom"); */}\n\n${fence(passing)}`,
      });
      expect(await ddt.run()).toEqual({ "doc.mdx:3": FAILED });
      expect(ddt.failures).toEqual(placed(markdown, { "doc.mdx:3": [[1, 21]] }));
    });
  });

  describe.concurrent.each([
    ["markdown", markdown],
    ["JSDoc", jsdocKind],
    ["indented JSDoc", indentedKind],
  ])(`${name} %s conformance`, (_, kind) => {
    test.each(locations)("points %s at its line", async (_title, doc, expected) => {
      await using ddt = openProject(kind, { "doc.md": doc });
      await ddt.run();
      expect(ddt.failures).toEqual(placed(kind, expected));
    });

    test.each(relocations)(
      "updates failure locations when %s in watch mode",
      async (_title, [[doc, expected], ...rest]) => {
        await using ddt = openProject(kind, { "guide.md": doc });
        await ddt.watch();
        expect(ddt.failures).toEqual(placed(kind, expected));
        for (const [next, nextExpected] of rest) {
          await ddt.edit("guide.md", next);
          expect(ddt.failures).toEqual(placed(kind, nextExpected));
        }
      },
    );

    test.each(parsing)("runs %s", async (_title, doc, expected) => {
      await using ddt = openProject(kind, { "doc.md": doc });
      expect(await ddt.run()).toEqual(located(kind, expected));
    });

    test.each(docs)("runs %s", async (_title, doc, expected) => {
      await using ddt = openProject(kind, { "doc.md": doc });
      expect(await ddt.run()).toEqual(located(kind, expected));
    });

    test.each(projects)("runs %s", async (_title, files, expected) => {
      await using ddt = openProject(kind, files);
      expect(await ddt.run()).toEqual(located(kind, expected));
    });

    test("imports packages from the project", async () => {
      await using ddt = openProject(kind, {
        ...calc,
        "README.md": fence(`${importNames("add", "calc")}\n\n${dialect.equal("add(1, 2)", "3")}`),
      });
      expect(await ddt.run()).toEqual(located(kind, { "README.md:1": PASSED }));
    });

    test("runs setup next to a fence that imports from the project", async () => {
      await using ddt = openProject(kind, {
        ...calc,
        "a.md": `<!-- ddt-setup const one = 1; -->\n\n${fence(`${importNames("add", "calc")}\n${dialect.equal("add(one, 2)", "3")}`)}`,
        "b.md": `<!-- ddt-setup ${importNames("add", "calc")} -->\n\n${fence(`${importNames("sep", "node:path")}\n${dialect.equal("add(1, 2)", "3")}\n${dialect.equal("typeof sep", '"string"')}`)}`,
      });
      expect(await ddt.run()).toEqual(located(kind, { "a.md:3": PASSED, "b.md:3": PASSED }));
    });

    test.each(edits)("reruns %s in watch mode", async (_title, [[doc, expected], ...rest]) => {
      await using ddt = openProject(kind, { "guide.md": doc });
      expect(await ddt.watch()).toEqual(located(kind, expected));
      for (const [next, outcomes] of rest) {
        expect(await ddt.edit("guide.md", next)).toEqual(located(kind, outcomes));
      }
    });

    test("runs a doc once it gains its first fence in watch mode", async () => {
      await using ddt = openProject(kind, {
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
      await using ddt = openProject(kind, {
        "guide.md": fence(passing),
        "other.md": fence(passing),
      });
      expect(await ddt.watch()).toEqual(
        located(kind, { "guide.md:1": PASSED, "other.md:1": PASSED }),
      );
      expect(await ddt.edit("guide.md", "# Guide\n")).toEqual({});
    });
  });

  describe.concurrent.each(dialect.nativeModules === false ? [] : [name])(
    "%s fence module system conformance",
    () => {
      const cases: [lang: Lang, code: string][] = [
        ["cjs", isRequireDefined("function")],
        ["cts", isRequireDefined("function")],
        ["mjs", `import { sep } from "node:path";\n${isRequireDefined("undefined")}\nsep;`],
        ["mts", `import { sep } from "node:path";\n${isRequireDefined("undefined")}\nsep;`],
      ];

      test.each(cases)("a %s fence names its module system", async (lang, code) => {
        await using ddt = openProject(markdown, { "doc.md": fence(code, ANNOTATIONS.RUN, lang) });
        expect(await ddt.run()).toEqual({ "doc.md:1": PASSED });
      });

      test("a ts fence with import syntax is ESM in any package", async () => {
        const code = `import { sep } from "node:path";\n${isRequireDefined("undefined")}\nsep;`;
        await using ddt = openProject(markdown, { "doc.md": fence(code) });
        expect(await ddt.run()).toEqual({ "doc.md:1": PASSED });
      });

      test("a type-only import does not make a ts fence ESM", async () => {
        const code = `import type { Stats } from "node:fs";\n${isRequireDefined(commonjs ? "function" : "undefined")}`;
        await using ddt = openProject(markdown, { "doc.md": fence(code) });
        expect(await ddt.run()).toEqual({ "doc.md:1": PASSED });
      });

      test("a ts fence follows the package", async () => {
        const code = isRequireDefined(commonjs ? "function" : "undefined");
        await using ddt = openProject(markdown, { "doc.md": fence(code) });
        expect(await ddt.run()).toEqual({ "doc.md:1": PASSED });
      });
    },
  );

  describe.concurrent.each(dialect.globals ? [dialect.globals] : [])(
    `${name} globals conformance`,
    ({ names, runner: withGlobals }) => {
      const importFromPath = typedImports<typeof import("node:path")>("node:path");
      const basename = importFromPath("basename");
      const sep = importFromPath("sep");
      const isFunction = (global: string): string =>
        dialect.equal(`typeof ${global}`, '"function"');

      const cases: [title: string, globals: Globals, doc: string, expected: Verdicts][] = [
        [
          "injects the default globals",
          { defaults: true, extra: [] },
          fence(lines(...names.map(injected))),
          { "doc.md:1": PASSED },
        ],
        [
          "injects extra globals beside the defaults",
          { defaults: true, extra: [basename] },
          fence(isFunction("basename")),
          { "doc.md:1": PASSED },
        ],
        [
          "injects a global under its alias",
          { defaults: true, extra: [importFromPath("basename", { alias: "base" })] },
          fence(lines(isFunction("base"), notInjected("basename"))),
          { "doc.md:1": PASSED },
        ],
        [
          "injects only the given globals without the defaults",
          { defaults: false, extra: [basename] },
          fence(lines(...names.map(notInjected), injected("basename"))),
          { "doc.md:1": PASSED },
        ],
        [
          "fails a fence that uses a global that is not injected",
          { defaults: false, extra: [] },
          fence(passing),
          { "doc.md:1": FAILED },
        ],
        [
          "lets a fence shadow a global with a declaration",
          { defaults: true, extra: [basename] },
          fence(lines("const basename = 5;", dialect.equal("basename", "5"))),
          { "doc.md:1": PASSED },
        ],
        [
          "lets a fence shadow a global with its own import",
          { defaults: true, extra: [sep] },
          fence(lines(importNames("sep", "node:path"), dialect.equal("typeof sep", '"string"'))),
          { "doc.md:1": PASSED },
        ],
        [
          "gives a setup comment the globals",
          { defaults: true, extra: [] },
          `<!-- ddt-setup ${dialect.equal("1", "1")} -->\n\n${fence(passing)}`,
          { "doc.md:3": PASSED },
        ],
        [
          "gives every fence of a doc the globals",
          { defaults: true, extra: [basename] },
          fence(isFunction("basename")) + fence(passing),
          { "doc.md:1": PASSED, "doc.md:5": PASSED },
        ],
      ];

      test.each(cases)("%s", async (_title, globals, doc, expected) => {
        await using ddt = openProject(
          markdown,
          { "doc.md": doc },
          ["doc.md"],
          withGlobals(globals),
        );
        expect(await ddt.run()).toEqual(expected);
      });

      test("gives a JSDoc fence the globals", async () => {
        const code = isFunction("basename");
        await using ddt = openProject(
          jsdocKind,
          { "doc.md": fence(code) },
          undefined,
          withGlobals({ defaults: true, extra: [basename] }),
        );
        expect(await ddt.run()).toEqual(located(jsdocKind, { "doc.md:1": PASSED }));
      });
    },
  );

  describe.each(dialect.typecheck ? [dialect.typecheck] : [])(
    `${name} typecheck conformance`,
    ({ runner: typechecking }) => {
      const checking = typechecking();
      const typeError = 'const count: number = "one";';
      const cases: [title: string, doc: string, expected: Verdicts][] = [
        [
          "passes a well typed fence",
          fence(`const n: number = 1;\n${dialect.equal("n", "1")}`),
          { "doc.md:1": PASSED },
        ],
        ["fails a fence with a type error", fence(typeError), { "doc.md:1": FAILED }],
        [
          "fails only the fence with the type error",
          fence(passing) + fence(typeError) + fence(passing),
          { "doc.md:1": PASSED, "doc.md:5": FAILED, "doc.md:9": PASSED },
        ],
        [
          "passes a compile_fail fence with a type error",
          fence(typeError, "compile_fail"),
          { "doc.md:1": PASSED },
        ],
        [
          "fails a compile_fail fence that type checks",
          fence(passing, "compile_fail"),
          { "doc.md:1": FAILED },
        ],
        [
          "fails a compile_only fence with a type error",
          fence(typeError, "compile_only"),
          { "doc.md:1": FAILED },
        ],
        [
          "passes a compile_only fence that type checks",
          fence(`${passing}\n${throwingBody}`, "compile_only"),
          { "doc.md:1": PASSED },
        ],
        [
          "checks the code of a setup comment",
          `<!-- ddt-setup ${typeError} -->\n\n${fence(passing)}`,
          { "doc.md:3": FAILED },
        ],
        [
          "does not check a skipped fence",
          fence(typeError, "skip") + fence(passing),
          { "doc.md:5": PASSED },
        ],
      ];

      test.each(cases)(
        "%s",
        async (_title, doc, expected) => {
          await using ddt = openProject(markdown, { "doc.md": doc }, ["doc.md"], checking);
          expect(await ddt.run()).toEqual(expected);
        },
        TYPECHECK_TIMEOUT,
      );

      test(
        "rechecks an edited fence in watch mode",
        async () => {
          await using ddt = openProject(
            markdown,
            { "guide.md": fence(passing) },
            ["guide.md"],
            checking,
          );
          expect(await ddt.watch()).toEqual({ "guide.md:1": PASSED });
          expect(await ddt.edit("guide.md", fence(typeError))).toEqual({ "guide.md:1": FAILED });
          expect(await ddt.edit("guide.md", fence(passing))).toEqual({ "guide.md:1": PASSED });
        },
        TYPECHECK_TIMEOUT,
      );

      test(
        "checks a JSDoc fence",
        async () => {
          await using ddt = openProject(
            jsdocKind,
            { "doc.md": fence(typeError) },
            undefined,
            checking,
          );
          expect(await ddt.run()).toEqual(located(jsdocKind, { "doc.md:1": FAILED }));
        },
        TYPECHECK_TIMEOUT,
      );

      const declaration = "declare const answer: number;";
      const augmentation = "declare global {\n  const answer: number;\n}\nexport {};";
      test.each([
        ["a declaration file tsconfig files lists", { files: ["types/a.d.ts"] }, PASSED],
        ["a declaration file tsconfig include matches", { include: ["types"] }, PASSED],
        ["a source file that augments globals", { include: ["src"] }, PASSED],
        ["nothing, when tsconfig lists neither", { include: ["docs"] }, FAILED],
      ])(
        "uses the globals of %s",
        async (_title, listing, expected) => {
          const compilerOptions = { strict: true, skipLibCheck: true };
          await using ddt = openProject(
            markdown,
            {
              "tsconfig.json": JSON.stringify({ compilerOptions, ...listing }),
              "types/a.d.ts": declaration,
              "src/register.ts": augmentation,
              // a type position, since the declaration has no value at runtime
              "doc.md": fence("const n: typeof answer = 1;"),
            },
            ["doc.md"],
            checking,
          );
          expect(await ddt.run()).toEqual({ "doc.md:1": expected });
        },
        TYPECHECK_TIMEOUT,
      );
    },
  );

  const jsdocProjects: [title: string, kind: Kind, files: Record<string, string>][] = [
    ["a .cts file", jsdocIn("cts", "1;"), {}],
    ["a .cjs file", jsdocIn("cjs", "1;"), {}],
    ["a CommonJS package", jsdocIn("ts", "1;"), { "package.json": '{ "type": "commonjs" }' }],
  ];

  describe.concurrent.each(
    // the CommonJS run is already a CommonJS package
    jsdocProjects.filter(([title]) => !commonjs || title !== "a CommonJS package"),
  )(`${name} JSDoc in %s conformance`, (_, kind, files) => {
    test.each(docs.slice(0, 2))("runs %s", async (_title, doc, expected) => {
      await using ddt = openProject(kind, { ...files, "doc.md": doc });
      expect(await ddt.run()).toEqual(located(kind, expected));
    });
  });

  describe.concurrent(`${name} JSDoc entry conformance`, () => {
    const documented = jsdocKind.content(fence(passing));

    test("runs no fences of a documented file that the runner only imports", async () => {
      await using ddt = open(
        runner,
        markdown,
        {
          ...project,
          "entry.ts": `${importOnly("./imported.ts")}\n`,
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
        ` * ${importNames("add", "calc")}`,
        ` * ${dialect.equal("add(1, 2)", "3")}`,
        " * ```",
        " */",
        ...(commonjs
          ? ["function add(a, b) {", "  return a + b;", "}", "module.exports = { add };"]
          : ["export function add(a: number, b: number): number {", "  return a + b;", "}"]),
        "",
      ].join("\n");
      await using ddt = open(
        runner,
        markdown,
        {
          "package.json": `{ "name": "calc", "type": "${commonjs ? "commonjs" : "module"}", "exports": "./math.ts" }`,
          "math.ts": math,
        },
        ["math.ts"],
      );
      expect(await ddt.run()).toEqual({ "math.ts:2": PASSED });
    });
  });
}
