import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Writable } from "node:stream";
import type { ParsedStack } from "vitest";
import type { ViteUserConfig } from "vitest/config";
import { createVitest, type Reporter, type TestUserConfig, type Vitest } from "vitest/node";
import { ddtPlugin, type DdtPluginOptions } from "@ddtds/vitest";

export async function create(
  root: string,
  {
    plugin = {},
    test = {},
    watch = false,
    reporter = {},
    output = {},
    coverage,
    logLevel,
  }: {
    plugin?: DdtPluginOptions;
    test?: ViteUserConfig["test"];
    watch?: boolean;
    reporter?: Reporter;
    output?: { stdout?: Writable; stderr?: Writable };
    coverage?: TestUserConfig["coverage"];
    logLevel?: ViteUserConfig["logLevel"];
  } = {},
): Promise<Vitest & AsyncDisposable> {
  const instance = await createVitest(
    "test",
    { root, config: false, watch, reporters: [reporter], ...(coverage && { coverage }) },
    {
      plugins: [ddtPlugin({ logLevel: "fatal", ...plugin })],
      // for nicer dev experience since it will pull in real source instead of
      // requiring dev server. source is tested in other example packages
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
  // vitest v4 does not make vitest a Disposable
  return Object.assign(instance, { [Symbol.asyncDispose]: () => instance.close() });
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
  await using instance = await create(root, { plugin, output, logLevel });
  await instance.globTestSpecifications();
  return lines;
}

export async function collect(
  root: string,
  plugin: DdtPluginOptions = {},
  test: ViteUserConfig["test"] = {},
): Promise<string[]> {
  await using instance = await create(root, { plugin, test });
  const specs = await instance.globTestSpecifications();
  return specs.map((spec) => relative(root, spec.moduleId)).toSorted();
}

type Failure = { error: string; diff?: string; frames: string[] };

function frame(root: string, { file, line, column }: ParsedStack): string {
  return `${relative(root, file).replace(/__ddtds__-\w+/, "__ddtds__")}:${line}:${column}`;
}

/** The first error of each failed test, with only the stack frames inside the fixture */
export async function failures(root: string): Promise<Record<string, Failure>> {
  await using instance = await create(root);
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

/** Where each test is declared, as Vitest reports it to editors */
export async function locations(root: string): Promise<Record<string, string>> {
  await using instance = await create(root, { test: { includeTaskLocation: true } });
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

/** Lines with statements that ran and that did not, per file, from v8 coverage */
export async function coverage(root: string): Promise<Record<string, Coverage>> {
  const reportsDirectory = join(root, "coverage");
  // Vitest writes the report when it closes, at the end of this block
  {
    await using instance = await create(root, {
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
