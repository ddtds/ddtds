import type { Outcomes, Runner, Watcher } from "@ddtds/test-utils";
import type { Reporter, TestModule } from "vitest/node";
import { create } from "./test-utils.ts";

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

export const vitest: Runner = {
  name: "vitest",
  async run(root, docs): Promise<Outcomes> {
    await using instance = await create(root, { plugin: { include: docs }, file: true });
    await instance.start();
    return outcomes(instance.state.getTestModules());
  },
  async watch(root, docs): Promise<Watcher> {
    const runs: Outcomes[] = [];
    let waiting: (() => void) | undefined;
    const reporter: Reporter = {
      onTestRunEnd(modules): void {
        runs.push(outcomes(modules));
        waiting?.();
      },
    };
    const instance = await create(root, {
      plugin: { include: docs },
      watch: true,
      reporter,
      file: true,
    });
    await instance.start();
    return {
      async next(): Promise<Outcomes> {
        if (runs.length === 0) {
          await new Promise<void>((resolve) => (waiting = resolve));
        }
        return runs.shift() ?? {};
      },
      async close(): Promise<void> {
        await instance.close();
      },
    };
  },
};
