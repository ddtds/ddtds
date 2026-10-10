import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { onTestFinished } from "vitest";
import type { ViteUserConfig } from "vitest/config";
import {
  createVitest,
  type Reporter,
  type TestCase,
  type TestModule,
  type Vitest,
} from "vitest/node";
import { ddtPlugin, type DdtPluginOptions } from "./index.ts";

type Outcomes = Record<string, string>;
type TestError = NonNullable<ReturnType<TestCase["result"]>["errors"]>[number];

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

async function vitest(
  root: string,
  {
    plugin = {},
    test = {},
    watch = false,
    reporter = {},
  }: {
    plugin?: DdtPluginOptions;
    test?: ViteUserConfig["test"];
    watch?: boolean;
    reporter?: Reporter;
  } = {},
): Promise<Vitest & AsyncDisposable> {
  const instance = await createVitest(
    "test",
    { root, config: false, watch, reporters: [reporter] },
    {
      plugins: [ddtPlugin({ logLevel: "silent", ...plugin })],
      resolve: { alias: { "@ddtds/vitest": join(import.meta.dirname, "index.ts") } },
      test,
    },
  );
  // vitest v4 does not make vitest a Disposable
  return Object.assign(instance, { [Symbol.asyncDispose]: () => instance.close() });
}

function outcome(error: TestError | undefined): string {
  if (!error) return "passed";
  if ("kind" in error) return String(error.kind);
  return "failed";
}

function outcomes(modules: readonly TestModule[]): Outcomes {
  const results: Outcomes = {};
  for (const module of modules) {
    for (const error of module.errors()) results[module.moduleId] = error.message;
    for (const testCase of module.children.allTests()) {
      const [error] = testCase.result().errors ?? [];
      results[testCase.name] = outcome(error);
    }
  }
  return results;
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

export async function watch(root: string, edit: () => void): Promise<Outcomes[]> {
  const runs: Outcomes[] = [];
  let rerunFinished: (() => void) | undefined;
  const reporter: Reporter = {
    onTestRunEnd(modules): void {
      runs.push(outcomes(modules));
      rerunFinished?.();
    },
  };
  await using instance = await vitest(root, { watch: true, reporter });
  await instance.start();
  const rerun = new Promise<void>((resolve) => (rerunFinished = resolve));
  edit();
  await rerun;
  return runs;
}
