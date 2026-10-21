/* oxlint-disable typescript/no-floating-promises -- node:test registers tests, it does not need awaiting */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import type { TestAdapter } from "./codegen/adapter.ts";
import { typedImports } from "./config.ts";
import { DdtSession } from "./docs/session.ts";

const major = process.env["TYPESCRIPT"];
assert(major === "5" || major === "6", "set TYPESCRIPT to 5 or 6");

const stub = typedImports<Record<string, unknown>>("test-stub");

const adapter: TestAdapter = {
  runtime: "@ddtds/vitest/runtime",
  testImport: stub("test"),
  fenceImports: [stub("expect")],
};

const compileErrorModule = /runtime\.compileError.*phase:"typecheck"/;
const compileErrorCall = /compileError/;
const projectOptions = {
  strict: true,
  target: "esnext",
  module: "preserve",
  moduleResolution: "bundler",
  jsx: "react-jsx",
  skipLibCheck: true,
};
const unreadableTsconfig = /typecheck could not read .*tsconfig\.json/;
const missingTsconfig = /typecheck needs a tsconfig\.json/;
const missingTypeScript = /typecheck needs "typescript" installed/;
const fence = (code: string, annotation = "run", lang = "ts"): string =>
  `\`\`\`${lang} ${annotation}\n${code}\n\`\`\`\n`;
const typescript = dirname(
  createRequire(import.meta.url).resolve(`typescript${major}/package.json`),
);
const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function project(
  guide: string,
  files: Record<string, string> = {},
  installed: "version-under-test" | "none" = "version-under-test",
): string {
  const root = mkdtempSync(join(tmpdir(), "ddtds-typecheck-"));
  roots.push(root);
  const modules = join(root, "node_modules");
  mkdirSync(join(modules, "test-stub"), { recursive: true });
  if (installed === "version-under-test") symlinkSync(typescript, join(modules, "typescript"));
  writeFileSync(join(root, "package.json"), '{ "type": "module" }');
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: projectOptions }));
  writeFileSync(
    join(modules, "test-stub/package.json"),
    '{ "name": "test-stub", "types": "index.d.ts" }',
  );
  writeFileSync(
    join(modules, "test-stub/index.d.ts"),
    "export declare function expect(actual: unknown): { toBe(expected: unknown): void };\n" +
      "export declare function test(name: string, run: () => unknown): void;\n",
  );
  writeFileSync(join(root, "guide.md"), guide);
  for (const [name, contents] of Object.entries(files)) writeFileSync(join(root, name), contents);
  return root;
}

async function errorLines(root: string): Promise<Record<number, number | undefined>> {
  const session = DdtSession.fromFiles(adapter, { root });
  const errors = session.typeErrors();
  return Object.fromEntries(
    Array.from(session.index.fences(), ({ id, block }) => [
      block.details.range.start.line,
      errors.get(id)?.details.diagnostics[0]?.labels[0]?.start.line,
    ]),
  );
}

function loadFence(guide: string): string {
  const session = DdtSession.fromFiles(adapter, { root: project(guide) });
  const id = [...session.index.fences()][0]?.id;
  assert(id !== undefined);
  return session.load(id, session.typeErrors())?.code ?? "";
}

describe(`TypeScript ${major}`, () => {
  test("a type error points at the markdown line", async () => {
    const root = project(
      [
        "# Guide",
        "",
        fence('const count: number = "one";'),
        fence("const count: number = 1;"),
      ].join("\n"),
    );
    assert.deepEqual(await errorLines(root), { 3: 4, 7: undefined });
  });

  test("injected globals are typed", async () => {
    const root = project(fence("expect(1).toBe(1);\nexpect(1).toBeFalse();"));
    assert.deepEqual(await errorLines(root), { 1: 3 });
  });

  test("an error in an injected global is not reported on the fence", async () => {
    const root = project(fence("const count: number = 1;"));
    const broken: TestAdapter = {
      ...adapter,
      fenceImports: [typedImports<Record<string, unknown>>("missing-module")("expect")],
    };
    const session = DdtSession.fromFiles(broken, { root });
    assert.equal(session.typeErrors().size, 0);
  });

  test("a fence importing a global itself does not clash", async () => {
    const root = project(fence('import { expect } from "test-stub";\nexpect(1).toBe(1);'));
    assert.deepEqual(await errorLines(root), { 1: undefined });
  });

  test("fences do not share declarations", async () => {
    const root = project([fence("const a = 1;"), fence("const a = 'two';")].join("\n"));
    assert.deepEqual(await errorLines(root), { 1: undefined, 5: undefined });
  });

  test("the project's tsconfig decides strictness", async () => {
    const loose = project(fence("function double(x) {\n  return x;\n}"), {
      "tsconfig.json": '{ "compilerOptions": { "strict": false } }',
    });
    assert.deepEqual(await errorLines(loose), { 1: undefined });
    const strict = project(fence("function double(x) {\n  return x;\n}"));
    assert.deepEqual(await errorLines(strict), { 1: 2 });
  });

  test("tsx fences use the project's jsx setting", async () => {
    const tsx = "```tsx run\nconst view = <div />;\n```\n";
    const configured = project(tsx, {
      "tsconfig.json": '{ "compilerOptions": { "jsx": "preserve", "strict": false } }',
    });
    assert.deepEqual(await errorLines(configured), { 1: undefined });
    const unconfigured = project(tsx, {
      "tsconfig.json": '{ "compilerOptions": { "strict": false } }',
    });
    assert.deepEqual(await errorLines(unconfigured), { 1: 2 });
  });

  test("a watch session rechecks fences when a project file they import changes", async () => {
    const guide = join(project(fence("")), "guide.md");
    const root = dirname(guide);
    mkdirSync(join(root, "libsrc"));
    writeFileSync(join(root, "libsrc/package.json"), '{ "name": "lib", "types": "index.ts" }');
    const source = join(root, "libsrc/index.ts");
    writeFileSync(source, "export const value: number = 1;");
    symlinkSync(join(root, "libsrc"), join(root, "node_modules/lib"));
    const importing = fence('import { value } from "lib";\nconst n: number = value;');
    writeFileSync(guide, importing);
    const session = DdtSession.fromFiles(adapter, { root });
    assert.equal(session.typeErrors().size, 0);

    writeFileSync(source, 'export const value: string = "one";');
    utimesSync(source, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
    writeFileSync(guide, `${importing}\n`);
    session.refresh(guide);
    assert.equal(session.typeErrors().size, 1);
  });

  test("a watch session rechecks only what an edit changed", async () => {
    const clean = fence("const count: number = 1;");
    const root = project([clean, fence("const name: string = 1;")].join("\n"));
    const session = DdtSession.fromFiles(adapter, { root });
    const failing = (): number[] =>
      Array.from(session.typeErrors().values(), ({ details }) => details.block.range.start.line);
    assert.deepEqual(failing(), [5]);
    assert.equal(session.typeErrors(), session.typeErrors());

    const guide = join(root, "guide.md");
    writeFileSync(guide, [fence("const count: number = 'one';"), clean].join("\n"));
    session.refresh(guide);
    assert.deepEqual(failing(), [1]);

    writeFileSync(guide, clean);
    session.refresh(guide);
    assert.deepEqual(failing(), []);
  });

  test("only ts and tsx fences are checked", async () => {
    const root = project(
      [
        fence("const count: number = 'one';", "run", "js"),
        fence("const count: number = 'one';", "run", "json"),
        fence("const count: number = 'one';"),
      ].join("\n"),
    );
    assert.deepEqual(await errorLines(root), { 1: undefined, 9: 10 });
  });

  test("setup comments are checked with the fence", async () => {
    const root = project(
      ["<!-- ddt-setup const root: number = 'one'; -->", "", fence("expect(root).toBe(1);")].join(
        "\n",
      ),
    );
    assert.deepEqual(await errorLines(root), { 3: 1 });
  });
});

describe("unsupported installs", () => {
  test("typecheck needs typescript installed", () => {
    const session = DdtSession.fromFiles(adapter, { root: project(fence("1;"), {}, "none") });
    assert.throws(() => session.typeErrors(), missingTypeScript);
  });

  test("typecheck fails on a tsconfig it cannot parse", () => {
    const root = project(fence("1;"), { "tsconfig.json": "{ not json" });
    assert.throws(() => DdtSession.fromFiles(adapter, { root }).typeErrors(), unreadableTsconfig);
  });

  test("typecheck needs a tsconfig", () => {
    const root = project(fence("1;"));
    rmSync(join(root, "tsconfig.json"));
    assert.throws(() => DdtSession.fromFiles(adapter, { root }).typeErrors(), missingTsconfig);
  });
});

describe("fence annotations", () => {
  const bad = "const count: number = 'one';";

  test("skipped and unannotated fences are not checked", async () => {
    const root = project(
      [fence(bad, "skip"), "```ts\n" + bad + "\n```\n", fence(bad, "compile_only")].join("\n"),
    );
    assert.deepEqual(await errorLines(root), { 9: 10 });
  });

  test("a fence with a type error fails to compile", () => {
    assert.match(loadFence(fence(bad)), compileErrorModule);
  });

  test("a compile_fail fence passes on a type error", () => {
    assert.doesNotMatch(loadFence(fence(bad, "compile_fail")), compileErrorCall);
  });

  test("a doc without ts fences does not need typescript", () => {
    const root = project(fence(bad, "run", "js"), {}, "none");
    assert.equal(DdtSession.fromFiles(adapter, { root }).typeErrors().size, 0);
  });
});
