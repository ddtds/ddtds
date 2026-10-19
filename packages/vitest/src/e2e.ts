import { emptyReport, type Report, type Runner, type Watcher } from "@ddtds/test-utils";
import type { Globals } from "@ddtds/test-utils/conformance";
import type { ViteUserConfig } from "vitest/config";
import type { Reporter, TestModule } from "vitest/node";
import { create, failureFrames, outcomes } from "./test-utils.ts";
import { defaultGlobals, type DdtPluginOptions } from "./index.ts";

export type VitestRunnerOptions = {
  plugin?: DdtPluginOptions;
  // a but cursed, but works with v4 and v5
  test?: ViteUserConfig["test"] & Record<string, unknown>;
};

const reportOf = (root: string, modules: readonly TestModule[]): Report => ({
  outcomes: outcomes(modules),
  failures: failureFrames(modules, root),
});

export function vitest(options: VitestRunnerOptions = {}): Runner {
  const plugin = (docs: string[]): DdtPluginOptions => ({ ...options.plugin, include: docs });

  return {
    name: "vitest",
    async run(root, docs): Promise<Report> {
      await using instance = await create(root, { plugin: plugin(docs), test: options.test });
      await instance.start();
      return reportOf(root, instance.state.getTestModules());
    },
    async watch(root, docs): Promise<Watcher> {
      const runs: Report[] = [];
      let waiting: (() => void) | undefined;
      const reporter: Reporter = {
        onTestRunEnd(modules): void {
          runs.push(reportOf(root, modules));
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
        async next(): Promise<Report> {
          if (runs.length === 0) {
            await new Promise<void>((resolve) => (waiting = resolve));
          }
          return runs.shift() ?? emptyReport;
        },
        async close(): Promise<void> {
          await instance.close();
        },
      };
    },
  };
}

export function vitestWithGlobals({ defaults, extra }: Globals): Runner {
  return vitest({ plugin: { globals: [...(defaults ? defaultGlobals : []), ...extra] } });
}
