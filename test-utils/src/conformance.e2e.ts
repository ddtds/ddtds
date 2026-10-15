import { describe, expect, test } from "vitest";
import { fence, spawn, type Outcomes, type Runner } from "./index.ts";

/** What a test framework has to say about itself; everything else is shared. */
export type Dialect = {
  /** An assertion that passes when `actual` equals `expected` */
  equal(actual: string, expected: string): string;
};

type Verdicts = Record<string, "passed" | "failed">;

/**
 * Scenarios care whether a fence passed, not which error a framework reports for it, and not
 * whether it reports on docs without fences. Fences are the outcomes named `doc:line`.
 */
const verdicts = (outcomes: Outcomes): Verdicts =>
  Object.fromEntries(
    Object.entries(outcomes)
      .filter(([id]) => /:\d+$/.test(id))
      .map(([id, outcome]) => [id, outcome === "passed" ? "passed" : "failed"]),
  );

type Opened = AsyncDisposable & {
  run(): Promise<Verdicts>;
  watch(): Promise<Verdicts>;
  edit(file: string, content: string): Promise<Verdicts>;
};

function open(runner: Runner, files: Record<string, string>): Opened {
  const ddt = spawn(runner, files);
  return {
    run: async () => verdicts(await ddt.run()),
    watch: async () => verdicts(await ddt.watch()),
    edit: async (file: string, content: string) => verdicts(await ddt.edit(file, content)),
    [Symbol.asyncDispose]: () => ddt[Symbol.asyncDispose](),
  };
}

const missingPackage = 'import { x } from "missing-package";\nx;';

/**
 * Registers the end to end scenarios every framework has to pass.
 *
 * To cover a new framework, add three small pieces to its package:
 *   1. a reporter that prints `encode(outcomes)` once per run (see `packages/node-test/src/reporter.ts`)
 *   2. a `cli({ name, command })` runner that starts the framework in run or watch mode
 *   3. a `conformance.test.ts` calling this with a `Dialect`
 *
 * Verdicts are named `doc:line`. A fence of one line takes four lines in a doc: its opening, the
 * code, its closing and a blank line, so the fences of a doc start at lines 1, 5, 9 and so on.
 */
export function conformance(name: string, runner: Runner, dialect: Dialect): void {
  const passing = dialect.equal("1", "1");
  const failing = dialect.equal("1", "2");

  /** A doc, and the verdict on each of its fences */
  const docs: [title: string, doc: string, expected: Verdicts][] = [
    ["a passing fence", fence(passing), { "doc.md:1": "passed" }],
    ["a failing assertion", fence(failing), { "doc.md:1": "failed" }],
    [
      "passing and failing fences under a heading",
      `# Guide\n\n${fence(`const sum: number = 1 + 1;\n${dialect.equal("sum", "2")}`)}${fence(failing)}`,
      { "doc.md:3": "passed", "doc.md:8": "failed" },
    ],
    ["a syntax error", fence("const = 1;"), { "doc.md:1": "failed" }],
    ["a syntax error at runtime", fence('JSON.parse("{");'), { "doc.md:1": "failed" }],
    ["an undeclared name", fence("missingFn();"), { "doc.md:1": "failed" }],
    ["a missing static import", fence(missingPackage), { "doc.md:1": "failed" }],
    [
      "a missing dynamic import",
      fence('await import("missing-package");'),
      { "doc.md:1": "failed" },
    ],
    [
      "a broken fence next to a passing one",
      fence(missingPackage) + fence(passing),
      { "doc.md:1": "failed", "doc.md:6": "passed" },
    ],
    [
      "a fail fence that throws",
      fence('throw new Error("boom");', "fail"),
      { "doc.md:1": "passed" },
    ],
    ["a fail fence that passes", fence("1;", "fail"), { "doc.md:1": "failed" }],
    ["a compile_fail fence that compiles", fence("1;", "compile_fail"), { "doc.md:1": "failed" }],
    [
      "a compile_fail fence that throws once compiled",
      fence('throw new Error("boom");', "compile_fail"),
      { "doc.md:1": "failed" },
    ],
    [
      "a compile_fail fence that does not compile",
      fence("const = 1;", "compile_fail"),
      { "doc.md:1": "passed" },
    ],
    [
      "an unclosed fence, which takes the rest of the doc as code",
      `\`\`\`ts run\n${passing}\n\n## Next section\n`,
      { "doc.md:1": "failed" },
    ],
    ["a js fence", fence(passing, "run", "js"), { "doc.md:1": "passed" }],
    ["a javascript fence", fence(passing, "run", "javascript"), { "doc.md:1": "passed" }],
    ["a typescript fence", fence(passing, "run", "typescript"), { "doc.md:1": "passed" }],
    [
      "a type error, which is not checked",
      fence(`const n: number = "a";\n${dialect.equal("n", '"a"')}`),
      { "doc.md:1": "passed" },
    ],
    [
      "a top level await",
      fence(`const one = await Promise.resolve(1);\n${dialect.equal("one", "1")}`),
      { "doc.md:1": "passed" },
    ],
    [
      "fences that do not share variables",
      fence("const shared = 1;") + fence(dialect.equal("shared", "1")),
      { "doc.md:1": "passed", "doc.md:5": "failed" },
    ],
    ["a fence that is skipped", fence(failing, "skip") + fence(passing), { "doc.md:5": "passed" }],
    [
      "a fence with an unknown annotation",
      fence(failing, "bogus") + fence(passing),
      { "doc.md:5": "passed" },
    ],
    [
      "a fence without an annotation",
      fence(failing, "") + fence(passing),
      { "doc.md:5": "passed" },
    ],
    [
      "a fence in a list",
      `- item\n\n  \`\`\`ts run\n  ${passing}\n  \`\`\`\n`,
      { "doc.md:3": "passed" },
    ],
    [
      "a fence in a blockquote",
      `> \`\`\`ts run\n> ${passing}\n> \`\`\`\n`,
      { "doc.md:1": "passed" },
    ],
    ["a fence in tildes", `~~~ts run\n${passing}\n~~~\n`, { "doc.md:1": "passed" }],
    [
      "a fence after an unclosed html tag",
      `<div\n\n\`\`\`ts run\n${passing}\n\`\`\`\n`,
      { "doc.md:3": "passed" },
    ],
  ];

  /** Docs in a project, and the verdict on each of their fences */
  const projects: [title: string, files: Record<string, string>, expected: Verdicts][] = [
    [
      "an mdx doc",
      { "doc.mdx": `# Guide\n\n{/* a comment */}\n\n${fence(passing)}` },
      { "doc.mdx:5": "passed" },
    ],
    [
      "a doc in a nested directory",
      { "docs/api/doc.md": fence(passing) },
      { "docs/api/doc.md:1": "passed" },
    ],
    [
      "several docs",
      { "one.md": fence(passing), "two.md": fence(failing) },
      { "one.md:1": "passed", "two.md:1": "failed" },
    ],
    [
      "a doc without code next to one with",
      { "empty.md": "# Nothing to run\n", "doc.md": fence(passing) },
      { "doc.md:1": "passed" },
    ],
  ];

  /** The versions a doc goes through, each with the verdict on its fences */
  type Version = [doc: string, expected: Verdicts];
  const edits: [title: string, versions: [Version, ...Version[]]][] = [
    [
      "a fence that starts passing, fails, then passes again",
      [
        [fence(passing), { "guide.md:1": "passed" }],
        [fence(failing), { "guide.md:1": "failed" }],
        [fence(passing), { "guide.md:1": "passed" }],
      ],
    ],
    [
      "a syntax error that is introduced and then fixed",
      [
        [fence(passing), { "guide.md:1": "passed" }],
        [fence("const = 1;"), { "guide.md:1": "failed" }],
        [fence(passing), { "guide.md:1": "passed" }],
      ],
    ],
    [
      "an annotation that changes",
      [
        [fence(failing), { "guide.md:1": "failed" }],
        [fence(failing, "fail"), { "guide.md:1": "passed" }],
        [fence(failing, "run"), { "guide.md:1": "failed" }],
      ],
    ],
    [
      "prose around a fence that changes",
      [
        [`# One\n\n${fence(passing)}`, { "guide.md:3": "passed" }],
        [`# Two\n\n${fence(passing)}`, { "guide.md:3": "passed" }],
      ],
    ],
    [
      "a second fence that is added",
      [
        [fence(passing), { "guide.md:1": "passed" }],
        [fence(passing) + fence(failing), { "guide.md:1": "passed", "guide.md:5": "failed" }],
      ],
    ],
    [
      "one of two fences that is removed",
      [
        [fence(passing) + fence(failing), { "guide.md:1": "passed", "guide.md:5": "failed" }],
        [fence(failing), { "guide.md:1": "failed" }],
      ],
    ],
    [
      "a fence that moves down the doc",
      [
        [fence(passing), { "guide.md:1": "passed" }],
        [`# Guide\n\n${fence(passing)}`, { "guide.md:3": "passed" }],
      ],
    ],
    [
      "fences that swap places",
      [
        [fence(passing) + fence(failing), { "guide.md:1": "passed", "guide.md:5": "failed" }],
        [fence(failing) + fence(passing), { "guide.md:1": "failed", "guide.md:5": "passed" }],
      ],
    ],
    [
      "one of two identical fences that is edited",
      [
        [fence(passing) + fence(passing), { "guide.md:1": "passed", "guide.md:5": "passed" }],
        [fence(failing) + fence(passing), { "guide.md:1": "failed", "guide.md:5": "passed" }],
      ],
    ],
  ];

  describe(`${name} conformance`, () => {
    test.each(docs)("runs %s", async (_title, doc, expected) => {
      await using ddt = open(runner, { "doc.md": doc });
      expect(await ddt.run()).toEqual(expected);
    });

    test.each(projects)("runs %s", async (_title, files, expected) => {
      await using ddt = open(runner, files);
      expect(await ddt.run()).toEqual(expected);
    });

    test("imports packages from the project", async () => {
      await using ddt = open(runner, {
        "node_modules/calc/package.json":
          '{ "name": "calc", "type": "module", "main": "index.js" }',
        "node_modules/calc/index.js": "export const add = (a, b) => a + b;",
        "README.md": fence(`import { add } from "calc";\n\n${dialect.equal("add(1, 2)", "3")}`),
      });
      expect(await ddt.run()).toEqual({ "README.md:1": "passed" });
    });

    test.each(edits)("reruns %s in watch mode", async (_title, [[doc, expected], ...rest]) => {
      await using ddt = open(runner, { "guide.md": doc });
      expect(await ddt.watch()).toEqual(expected);
      for (const [next, outcomes] of rest) {
        // each edit must be seen before the next one is made
        // oxlint-disable-next-line no-await-in-loop
        expect(await ddt.edit("guide.md", next)).toEqual(outcomes);
      }
    });

    test("runs a doc once it gains its first fence in watch mode", async () => {
      await using ddt = open(runner, { "guide.md": "# Guide\n", "other.md": fence(passing) });
      expect(await ddt.watch()).toEqual({ "other.md:1": "passed" });
      expect(await ddt.edit("guide.md", fence(passing))).toEqual({ "guide.md:1": "passed" });
      expect(await ddt.edit("guide.md", fence(failing))).toEqual({ "guide.md:1": "failed" });
    });
  });
}
