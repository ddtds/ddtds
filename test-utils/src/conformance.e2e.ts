/* tests common properties of test frameworks
 * for example, watch mode should rerun when a
 * fence is modified
 */

import { describe, expect, test } from "vitest";
import { fence, spawn, type Outcomes, type Runner } from "./index.ts";

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

/** Where a doc's markdown lives: in a markdown file, or in a JSDoc comment of a source file */
type Kind = {
  title: string;
  /** The runner's file for a markdown file */
  file(markdown: string): string;
  content(markdown: string): string;
  /** The markdown id for an id the runner reports */
  id(reported: string): string;
};

const markdown: Kind = {
  title: "markdown",
  file: (name) => name,
  content: (text) => text,
  id: (reported) => reported,
};

const jsdoc: Kind = {
  title: "JSDoc",
  file: (name) => name.replace(/\.mdx?$/, ".ts"),
  content(text) {
    const lines = text
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => (line === "" ? " *" : ` * ${line}`));
    return ["/**", ...lines, " */", "export {};", ""].join("\n");
  },
  // the comment opens one line above the markdown
  id: (reported) => reported.replace(/\.ts:(\d+)$/, (_, line) => `.md:${Number(line) - 1}`),
};

type Opened = AsyncDisposable & {
  run(): Promise<Verdicts>;
  watch(): Promise<Verdicts>;
  edit(file: string, content: string): Promise<Verdicts>;
};

const isMarkdown = (file: string): boolean => /\.mdx?$/.test(file);

function open(runner: Runner, kind: Kind, files: Record<string, string>): Opened {
  const converted = Object.fromEntries(
    Object.entries(files).map(([file, text]) =>
      isMarkdown(file) ? [kind.file(file), kind.content(text)] : [file, text],
    ),
  );
  const docs = Object.keys(files)
    .filter(isMarkdown)
    .map((file) => kind.file(file));
  const ddt = spawn(runner, converted, { docs });
  const normalize = (outcomes: Outcomes): Verdicts =>
    Object.fromEntries(Object.entries(verdicts(outcomes)).map(([id, v]) => [kind.id(id), v]));
  return {
    run: async () => normalize(await ddt.run()),
    watch: async () => normalize(await ddt.watch()),
    edit: async (file, content) =>
      normalize(await ddt.edit(kind.file(file), kind.content(content))),
    [Symbol.asyncDispose]: () => ddt[Symbol.asyncDispose](),
  };
}

const missingPackage = 'import { x } from "missing-package";\nx;';

export function conformance(
  name: string,
  runner: Runner,
  dialect: Dialect,
  { jsdoc: runsJsDoc = true }: { jsdoc?: boolean } = {},
): void {
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

  describe.each(runsJsDoc ? [markdown, jsdoc] : [markdown])(
    `${name} $title conformance`,
    (kind) => {
      test.each(docs)("runs %s", async (_title, doc, expected) => {
        await using ddt = open(runner, kind, { "doc.md": doc });
        expect(await ddt.run()).toEqual(expected);
      });

      test.each(projects)("runs %s", async (_title, files, expected) => {
        await using ddt = open(runner, kind, files);
        expect(await ddt.run()).toEqual(expected);
      });

      test("imports packages from the project", async () => {
        await using ddt = open(runner, kind, {
          "node_modules/calc/package.json":
            '{ "name": "calc", "type": "module", "main": "index.js" }',
          "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
          "README.md": fence(`import { add } from "calc";\n\n${dialect.equal("add(1, 2)", "3")}`),
        });
        expect(await ddt.run()).toEqual({ "README.md:1": PASSED });
      });

      test.each(edits)("reruns %s in watch mode", async (_title, [[doc, expected], ...rest]) => {
        await using ddt = open(runner, kind, { "guide.md": doc });
        expect(await ddt.watch()).toEqual(expected);
        for (const [next, outcomes] of rest) {
          // oxlint-disable-next-line no-await-in-loop
          expect(await ddt.edit("guide.md", next)).toEqual(outcomes);
        }
      });

      test("runs a doc once it gains its first fence in watch mode", async () => {
        await using ddt = open(runner, kind, {
          "guide.md": "# Guide\n",
          "other.md": fence(passing),
        });
        expect(await ddt.watch()).toEqual({ "other.md:1": PASSED });
        expect(await ddt.edit("guide.md", fence(passing))).toEqual({ "guide.md:1": PASSED });
        expect(await ddt.edit("guide.md", fence(failing))).toEqual({ "guide.md:1": FAILED });
      });

      test("stops running a doc once it loses its last fence in watch mode", async () => {
        await using ddt = open(runner, kind, {
          "guide.md": fence(passing),
          "other.md": fence(passing),
        });
        expect(await ddt.watch()).toEqual({ "guide.md:1": PASSED, "other.md:1": PASSED });
        expect(await ddt.edit("guide.md", "# Guide\n")).toEqual({});
      });
    },
  );
}
