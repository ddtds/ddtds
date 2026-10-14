import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { onTestFinished, type ParsedStack } from "vitest";
import type { ViteUserConfig } from "vitest/config";
import {
  createVitest,
  type Reporter,
  type TestModule,
  type TestUserConfig,
  type Vitest,
} from "vitest/node";
import { ddtPlugin, type DdtPluginOptions } from "@ddtds/vitest";

type Outcomes = Record<string, string>;

export function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

export function fence(code: string, annotation = "run"): string {
  return `\`\`\`ts ${annotation}\n${code}\n\`\`\`\n\n`;
}

let configs = 0;

function writeConfig(
  root: string,
  plugin: DdtPluginOptions,
  test: ViteUserConfig["test"],
  logLevel: ViteUserConfig["logLevel"],
): string {
  const source = join(import.meta.dirname, "index.ts");
  const config = join(root, `vitest.config.${++configs}.ts`);
  const alias = {
    "@ddtds/vitest/runtime": join(import.meta.dirname, "runtime.ts"),
    "@ddtds/vitest": source,
  };
  writeFileSync(
    config,
    `import { defineConfig } from "vitest/config";
import { ddtPlugin } from ${JSON.stringify(pathToFileURL(source).href)};

export default defineConfig({
  plugins: [ddtPlugin(${JSON.stringify(plugin)})],
  resolve: { alias: ${JSON.stringify(alias)} },
  test: ${JSON.stringify(test ?? {})},
  logLevel: ${JSON.stringify(logLevel)},
});
`,
  );
  return config;
}

async function vitest(
  root: string,
  {
    plugin = {},
    test = {},
    watch = false,
    reporter = {},
    output = {},
    coverage,
    logLevel,
    file = false,
  }: {
    plugin?: DdtPluginOptions;
    test?: ViteUserConfig["test"];
    watch?: boolean;
    reporter?: Reporter;
    output?: { stdout?: Writable; stderr?: Writable };
    coverage?: TestUserConfig["coverage"];
    logLevel?: ViteUserConfig["logLevel"];
    file?: boolean;
  } = {},
): Promise<Vitest & AsyncDisposable> {
  const options = { logLevel: "fatal", ...plugin } satisfies DdtPluginOptions;
  const config = file ? writeConfig(root, options, test, logLevel) : false;
  const instance = await createVitest(
    "test",
    { root, config, watch, reporters: [reporter], ...(coverage && { coverage }) },
    config
      ? undefined
      : {
          plugins: [ddtPlugin(options)],
          resolve: {
            alias: {
              "@ddtds/vitest/runtime": join(import.meta.dirname, "runtime.ts"),
              "@ddtds/vitest": join(import.meta.dirname, "index.ts"),
            },
          },
          test,
          logLevel,
        },
    output,
  );
  return Object.assign(instance, { [Symbol.asyncDispose]: () => instance.close() });
}

function outcomes(modules: readonly TestModule[]): Outcomes {
  const results: Outcomes = {};
  for (const module of modules) {
    const [moduleError] = module.errors();
    if (moduleError) results[module.moduleId] = moduleError.message;
    for (const testCase of module.children.allTests()) {
      const { state, errors } = testCase.result();
      results[testCase.name] = errors?.[0]?.name ?? state;
    }
  }
  return results;
}

export async function logs(
  root: string,
  plugin: DdtPluginOptions,
  logLevel?: ViteUserConfig["logLevel"],
): Promise<string[]> {
  const lines: string[] = [];
  const stream = (name: string): Writable =>
    new Writable({
      write(chunk: Buffer, _encoding, done): void {
        for (const line of String(chunk).split("\n")) {
          if (line.includes("[ddtds]")) lines.push(`${name}: ${line.trim()}`);
        }
        done();
      },
    });
  const output = { stdout: stream("stdout"), stderr: stream("stderr") };
  await using instance = await vitest(root, { plugin, output, logLevel });
  await instance.globTestSpecifications();
  return lines;
}

export async function collect(
  root: string,
  plugin: DdtPluginOptions = {},
  test: ViteUserConfig["test"] = {},
): Promise<string[]> {
  await using instance = await vitest(root, { plugin, test });
  const specs = await instance.globTestSpecifications();
  return specs.map((spec) => relative(root, spec.moduleId)).toSorted();
}

export async function run(root: string, plugin: DdtPluginOptions = {}): Promise<Outcomes> {
  await using instance = await vitest(root, { plugin });
  await instance.start();
  return outcomes(instance.state.getTestModules());
}

type Failure = { error: string; diff?: string; frames: string[] };

function frame(root: string, { file, line, column }: ParsedStack): string {
  return `${relative(root, file).replace(/__ddtds__-\w+/, "__ddtds__")}:${line}:${column}`;
}

export async function failures(root: string): Promise<Record<string, Failure>> {
  await using instance = await vitest(root);
  await instance.start();
  const results: Record<string, Failure> = {};
  for (const module of instance.state.getTestModules()) {
    for (const testCase of module.children.allTests()) {
      const [error] = testCase.result().errors ?? [];
      if (!error) continue;
      const frames = (error.stacks ?? [])
        .filter(({ file }) => file.startsWith(root))
        .map((stack) => frame(root, stack));
      results[testCase.name] = {
        error: `${error.name}: ${error.message}`,
        diff: error.diff,
        frames,
      };
    }
  }
  return results;
}

export async function locations(root: string): Promise<Record<string, string>> {
  await using instance = await vitest(root, { test: { includeTaskLocation: true } });
  await instance.start();
  const results: Record<string, string> = {};
  for (const module of instance.state.getTestModules()) {
    for (const testCase of module.children.allTests()) {
      const { line, column } = testCase.location ?? {};
      results[testCase.name] = `${line}:${column}`;
    }
  }
  return results;
}

type Coverage = { covered: number[]; uncovered: number[] };
type Location = { start: { line: number } };
type FileCoverage = { s: Record<string, number>; statementMap: Record<string, Location> };

export async function coverage(root: string): Promise<Record<string, Coverage>> {
  const reportsDirectory = join(root, "coverage");
  {
    await using instance = await vitest(root, {
      coverage: { enabled: true, provider: "v8", reporter: ["json"], reportsDirectory },
    });
    await instance.start();
  }
  const report: Record<string, FileCoverage> = JSON.parse(
    readFileSync(join(reportsDirectory, "coverage-final.json"), "utf8"),
  );
  const files = Object.entries(report);
  return Object.fromEntries(
    files.map(([file, data]) => [relative(root, file), coverageLines(data)]),
  );
}

function sorted(lines: Set<number>): number[] {
  return [...lines].toSorted((a, b) => a - b);
}

function coverageLines({ s, statementMap }: FileCoverage): Coverage {
  const covered = new Set<number>();
  const uncovered = new Set<number>();
  for (const [id, hits] of Object.entries(s)) {
    const line = statementMap[id]?.start.line;
    if (line !== undefined) (hits > 0 ? covered : uncovered).add(line);
  }
  return { covered: sorted(covered), uncovered: sorted(uncovered) };
}

export async function watch(root: string, edit: () => void): Promise<Outcomes[]> {
  const runs: Outcomes[] = [];
  let rerunFinished: (() => void) | undefined;
  const reporter: Reporter = {
    onTestRunEnd(modules): void {
      runs.push(outcomes(modules));
      rerunFinished?.();
    },
  };
  await using instance = await vitest(root, { watch: true, reporter, file: true });
  await instance.start();
  const rerun = new Promise<void>((resolve) => (rerunFinished = resolve));
  edit();
  await rerun;
  return runs;
}
