import type { Outcomes, Runner, Watcher } from "@ddtds/test-utils";
import type { ViteUserConfig } from "vitest/config";
import type { Reporter } from "vitest/node";
import { create, outcomes } from "./test-utils.ts";
import type { DdtPluginOptions } from "./index.ts";

export type VitestRunnerOptions = {
  plugin?: DdtPluginOptions;
  /**
   * Any Vitest `test` config, e.g. `{ fsModuleCache: true }`. The index
   * signature lets options from a newer Vitest (like `fsModuleCache`) type-check
   * against an older one.
   */
  test?: ViteUserConfig["test"] & Record<string, unknown>;
};

/** The in-process Vitest, configured like `create` (plugin + any `test` options). */
export function vitest(options: VitestRunnerOptions = {}): Runner {
  const plugin = (docs: string[]): DdtPluginOptions => ({ ...options.plugin, include: docs });

  return {
    name: "vitest",
    async run(root, docs): Promise<Outcomes> {
      await using instance = await create(root, { plugin: plugin(docs), test: options.test });
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
        plugin: plugin(docs),
        test: options.test,
        watch: true,
        reporter,
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
}
