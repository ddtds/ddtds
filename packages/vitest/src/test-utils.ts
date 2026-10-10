import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { onTestFinished } from "vitest";
import type { ViteUserConfig } from "vitest/config";
import { createVitest, type Reporter, type TestModule, type Vitest } from "vitest/node";
import { ddtPlugin, type DdtPluginOptions } from "./index.ts";

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
): Promise<Vitest> {
  return createVitest(
    "test",
    { root, config: false, watch, reporters: [reporter] },
    {
      plugins: [ddtPlugin({ logLevel: "silent", ...plugin })],
      resolve: { alias: { "@ddtds/vitest": join(import.meta.dirname, "index.ts") } },
      test,
    },
  );
}

function outcomes(modules: readonly TestModule[]): Outcomes {
  const results: Outcomes = {};
  for (const module of modules) {
    for (const error of module.errors()) results[module.moduleId] = error.message;
    for (const testCase of module.children.allTests()) {
      const [error] = testCase.result().errors ?? [];
      results[testCase.name] = !error ? "passed" : "kind" in error ? String(error.kind) : "failed";
    }
  }
  return results;
}

export async function collect(
  root: string,
  plugin: DdtPluginOptions = {},
  test: ViteUserConfig["test"] = {},
): Promise<string[]> {
  const instance = await vitest(root, { plugin, test });
  try {
    const specs = await instance.globTestSpecifications();
    return specs.map((spec) => relative(root, spec.moduleId)).toSorted();
  } finally {
    await instance.close();
  }
}

export async function run(root: string, plugin: DdtPluginOptions = {}): Promise<Outcomes> {
  const instance = await vitest(root, { plugin });
  try {
    await instance.start();
    return outcomes(instance.state.getTestModules());
  } finally {
    await instance.close();
  }
}
