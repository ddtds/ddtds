import type { Outcomes, Runner, Watcher } from "@ddtds/test-utils";
import type { Reporter } from "vitest/node";
import { create, outcomes } from "./test-utils.ts";

export const vitest: Runner = {
  name: "vitest",
  async run(root, docs): Promise<Outcomes> {
    await using instance = await create(root, { plugin: { include: docs } });
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
